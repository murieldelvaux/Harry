import * as XLSX from "xlsx";
import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ConfigService } from "@nestjs/config";
import {
  AIIntent,
  ExpenseCategory,
  RecordScope,
  ParsedWhatsAppResultDto,
} from "../../../../packages/shared/src";

@Injectable()
export class AiParserService {
  private readonly logger = new Logger(AiParserService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  private getParserSchema() {
    return {
      type: SchemaType.OBJECT,
      properties: {
        intent: {
          type: SchemaType.STRING,
          enum: [
            AIIntent.CREATE_EXPENSE,
            AIIntent.CREATE_TASK,
            AIIntent.CREATE_GOAL,
            AIIntent.CREATE_EVENT,
            AIIntent.CREATE_SHOPPING_ITEM,
            AIIntent.QUERY_CALENDAR,
            AIIntent.QUERY_TASKS,
            AIIntent.QUERY_SHOPPING_LIST,
            AIIntent.UNKNOWN,
          ],
        },
        confidence: { type: SchemaType.NUMBER },
        data: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            amount: { type: SchemaType.NUMBER },
            category: {
              type: SchemaType.STRING,
              enum: [
                ExpenseCategory.FOOD_MARKET,
                ExpenseCategory.RESTAURANT,
                ExpenseCategory.TRANSPORTATION,
                ExpenseCategory.HEALTH,
                ExpenseCategory.LEISURE,
                ExpenseCategory.UTILITIES,
                ExpenseCategory.SUBSCRIPTIONS,
                ExpenseCategory.OTHER,
              ],
            },
            scope: {
              type: SchemaType.STRING,
              enum: [RecordScope.PRIVATE, RecordScope.SHARED],
            },
            dueDate: { type: SchemaType.STRING },
            hasSpecificTime: { type: SchemaType.BOOLEAN },
            startDate: { type: SchemaType.STRING },
            endDate: { type: SchemaType.STRING },
            isAllDay: { type: SchemaType.BOOLEAN },
            location: { type: SchemaType.STRING },
            notes: { type: SchemaType.STRING },
            queryPeriod: {
              type: SchemaType.STRING,
              enum: ["today", "tomorrow", "week", "specific_date"],
            },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  quantity: { type: SchemaType.STRING },
                  category: { type: SchemaType.STRING },
                },
                required: ["name"],
              },
            },
          },
          required: ["title", "scope"],
        },
      },
      required: ["intent", "confidence", "data"],
    };
  }

  private async generateWithModelFallback(
    promptContent: string | Array<any>,
    now: Date = new Date(),
  ): Promise<ParsedWhatsAppResultDto | null> {
    if (!this.genAI) return null;

    // Modelos com suporte multimodal de áudio e texto, com fallback transparente
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ];

    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: this.getParserSchema(),
            temperature: 0.1,
          },
        });

        const result = await model.generateContent(promptContent as any);
        const text = result.response.text();
        if (text) {
          const parsed = JSON.parse(text) as ParsedWhatsAppResultDto;
          this.logger.log(`Parsed successfully via ${modelName}: ${JSON.stringify(parsed)}`);
          return parsed;
        }
      } catch (err: any) {
        this.logger.warn(`Model ${modelName} failed or busy (${err?.message || err}). Trying fallback...`);
        // Pausa curta de 200ms para absorver picos de demanda
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    return null;
  }

  async parseMessage(messageText: string, now: Date = new Date()): Promise<ParsedWhatsAppResultDto> {
    const referenceIso = now.toISOString();

    // 1. Tentar via Gemini API com Structured Outputs e Fallback de Modelos
    if (this.genAI) {
      const prompt = `Você é o Harry, assistente inteligente oficial (gestão financeira, agenda, tarefas e rotina pessoal/casal).
Data e hora atual de referência: ${referenceIso} (fuso horário de Brasília UTC-3).

REGRA ALEXA DE ACIONAMENTO (WAKE WORD 'HARRY'):
- O usuário aciona você chamando por "Harry" no início (como se faz com a Alexa).
- Se a mensagem contiver o prefixo "Harry,", "Harry " ou saudações como "Oi Harry,", ignore essa palavra de ativação e processe o comando principal.

Analise a mensagem em português e extraia as informações estruturadas.
ATENÇÃO: Tenha total tolerância com linguagem falada informal, digitação rápida e erros de transcrição de áudio cotidianos (por exemplo: "gatei" = "gastei", "comprei", "paguei", "deu 15 reais", "fiz as unhas deu 15", etc.):

REGRA DE OURO SOBRE ESCOPO (PRIVADO vs COMPARTILHADO):
- Se a mensagem contiver explicitamente palavras como "compartilhado", "compartilhada", "compartilhar", "para nós", "pra nós", "juntos", "do casal", "nossa", "nosso", "da casa", ou se o usuário falar isso no final da frase (ex: "gastei 15 manicure compartilhado", "dentista amanhã 13:10 compartilhado", "comprar leite compartilhado", "almoço 40 compartilhado"):
  O "scope" É OBRIGATORIAMENTE "SHARED"!
- Se nenhuma menção de compartilhamento for feita: o "scope" é "PRIVATE".

0. CONSULTAS E VISUALIZAÇÃO (QUERY_CALENDAR, QUERY_TASKS, QUERY_SHOPPING_LIST):
- Se o usuário pedir para ver ou consultar agenda/compromissos (ex: "minha agenda", "o que tenho hoje?", "agenda de amanhã", "o que tenho amanhã?", "compromissos de amanhã", "minha agenda da semana", "agenda dessa semana", "o que tenho essa semana?", "compromissos da semana", "próximos dias"):
  Classifique OBRIGATORIAMENTE como QUERY_CALENDAR!
  Preencha no campo "queryPeriod":
  - "tomorrow": se perguntar sobre amanhã (ex: "minha agenda de amanhã", "o que tenho amanhã?", "agenda pra amanhã", "compromissos de amanhã").
  - "week": se perguntar sobre a semana ou próximos dias (ex: "minha agenda da semana", "agenda dessa semana", "o que tenho essa semana?", "compromissos da semana", "próximos dias").
  - "today": se for para hoje ou se não especificar o período (ex: "minha agenda", "o que tenho hoje?", "agenda de hoje").
- Se pedir para ver lembretes/tarefas (ex: "meus lembretes", "o que tenho para fazer?"): QUERY_TASKS.
- Se pedir para ver lista de compras (ex: "minha lista de compras", "o que tem pra comprar?"): QUERY_SHOPPING_LIST.

1. COMPROMISSOS E EVENTOS DE AGENDA (CREATE_EVENT):
- Se indicar agendamento de compromisso, consulta, dentista, médico, reunião, aniversário ou evento (ex: "Agendar dentista amanhã as 13:10", "Dentista amanhã às 13:10", "Marcar médico amanhã às 14h", "Adicionar dentista amanhã na minha agenda as 13:30", "Reunião sexta às 10h"):
  Classifique OBRIGATORIAMENTE como CREATE_EVENT!
  NÃO exija palavras como "na minha agenda" ou "novo evento". "Agendar dentista amanhã as 13:10" É um CREATE_EVENT!
- "title": título do compromisso limpo (ex: "Dentista", "Consulta médica", "Reunião"). Remova "agendar", "marcar", horários, datas e a palavra "compartilhado" se falada no fim.
- "startDate": data e hora ISO exata calculada a partir de ${referenceIso} com offset de Brasília (-03:00). Exemplo: para amanhã às 13:10 retorne a data de amanhã com horário 13:10:00-03:00 (NUNCA retorne com Z se alterar o horário).
- "endDate": data e hora de término ISO (se não informado, 1 hora após startDate).
- "isAllDay": false se tiver horário, true se dia inteiro.
- "location": local se mencionado.
- "scope": defina conforme a REGRA DE OURO SOBRE ESCOPO acima (SHARED se tiver 'compartilhado', senão PRIVATE).

2. GASTOS E DESPESAS (CREATE_EXPENSE):
- Qualquer gasto ou pagamento realizado (ex: "Gatei 15 reais na manicure", "gastei 15 na manicure", "deu 15 na manicure", "paguei 30 no almoço", "Uber 25", "Farmácia 40"):
  Classifique OBRIGATORIAMENTE como CREATE_EXPENSE!
  Tolerância fonética e coloquial: "gatei", "gastei", "comprei", "paguei", "deu", "custou".
- "amount": valor numérico gasto (ex: 15).
- "title": descrição limpa do gasto (ex: "Manicure", "Almoço", "Uber"). Remova a palavra "compartilhado" se falada no fim.
- "category": categoria mais adequada (HEALTH para manicure/estética/remédio/médico, RESTAURANT para almoço/jantar, TRANSPORTATION para uber/gasolina, FOOD_MARKET para mercado, etc.).
- "scope": defina conforme a REGRA DE OURO SOBRE ESCOPO acima (SHARED se tiver 'compartilhado', senão PRIVATE).
- NUNCA classifique como CREATE_EXPENSE se houver a palavra "meta", "poupar" ou "guardar".

3. LISTA DE COMPRAS (CREATE_SHOPPING_ITEM):
- Se a mensagem indicar itens a comprar ou adicionar na lista (ex: "comprar leite, queijo e ovos", "colocar pão na lista", "adicionar geleia", "por café na lista"):
  Classifique como CREATE_SHOPPING_ITEM.
- OBRIGATÓRIO: Extraia APENAS o nome limpo do produto (remova verbos de ação como "adicionar", "comprar", "colocar", "bota", "botar", "incluir", "por", "pôr" e "na lista", "pra lista", "de compras"). Exemplo: "Adicionar geleia" -> items: [{ name: "Geleia", quantity: "1" }], title: "Geleia".
- "items": array de itens extraídos com "name" limpo (ex: "Geleia", "Leite", "Pão") e "quantity".
- "title": nome limpo do primeiro item ou resumo dos itens.

4. METAS (CREATE_GOAL):
- SE contiver "meta", "objetivo", "guardar", "poupar", "juntar dinheiro" (ex: "Guardar 2000 na meta carro", "Meta viagem 5000"):
  Classifique como CREATE_GOAL.
- "amount": valor numérico alvo.
- "title": nome limpo da meta.

5. LEMBRETES E TAREFAS (CREATE_TASK):
- Se indicar lembrete pontual (ex: "Lembrar de pagar conta de luz", "Me lembre de ligar para o cliente daqui 30 min"):
  Classifique como CREATE_TASK.
- "title": descrição limpa.
- "dueDate": data e hora calculada a partir de ${referenceIso}.
- "hasSpecificTime": true se especificou horário/minutos, false caso contrário.

Mensagem: "${messageText}"`;

      const parsed = await this.generateWithModelFallback(prompt, now);
      if (parsed) {
        const lower = messageText.toLowerCase();
        if (/\b(?:compartilhad[ao]s?|compartilhar|pra nós|para nós|do casal|da casa|juntos)\b/i.test(lower)) {
          parsed.data.scope = RecordScope.SHARED;
        }
        if (parsed.data?.title) {
          parsed.data.title = parsed.data.title
            .replace(/\s*\b(?:compartilhad[ao]s?|compartilhar)\b\s*$/i, "")
            .trim();
        }
        return parsed;
      }
    }

    // 2. Fallback Heurístico Robusto (em caso de offline ou falha de rede)
    return this.heuristicFallback(messageText, now);
  }

  async parseMedia(
    mediaBuffer: Buffer,
    mimeType: string,
    caption?: string,
    now: Date = new Date(),
  ): Promise<ParsedWhatsAppResultDto> {
    const referenceIso = now.toISOString();
    const cleanMimeType = (mimeType || "image/jpeg").split(";")[0].trim();

    // Se for arquivo de planilha Excel (.xlsx, .xls) ou CSV, converte para texto estruturado
    if (
      cleanMimeType.includes("spreadsheet") ||
      cleanMimeType.includes("excel") ||
      cleanMimeType.includes("csv") ||
      (caption && /\.(xlsx|xls|csv)$/i.test(caption))
    ) {
      try {
        const workbook = XLSX.read(mediaBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const tableText = rows
          .map((r) => (Array.isArray(r) ? r.filter(Boolean).join(" | ") : ""))
          .filter(Boolean)
          .join("\n");
        this.logger.log(`Planilha convertida em texto (linhas: ${rows.length}): \n${tableText.slice(0, 300)}...`);
        return this.parseMessage("Adicionar na lista de compras os seguintes itens da planilha:\n" + tableText, now);
      } catch (err) {
        this.logger.warn(`Erro ao extrair planilha via xlsx: ${err}`);
      }
    }

    if (this.genAI) {
      const prompt = `Você é o Harry, assistente inteligente multimodal pessoal e familiar (gestão financeira, agenda, tarefas e rotina).
Data e hora atual de referência: ${referenceIso} (fuso horário de Brasília UTC-3).
${caption ? `Legenda da mensagem enviada pelo usuário: "${caption}"` : ""}

Analise com precisão a mídia fornecida (pode ser foto de comprovante/recibo/cupom fiscal ou áudio de voz em português):

ATENÇÃO CRÍTICA PARA TRANSCRIÇÃO DE ÁUDIO DE VOZ:
- O usuário frequentemente inicia o áudio chamando pelo nome "Harry" (estilo Alexa, ex: "Harry, anota 50 de mercado", "Harry, o que tenho na agenda amanhã?"). Ignore a saudação/wake word "Harry" ao extrair o título e comando!
- A voz do usuário em português do Brasil frequentemente tem pronúncias rápidas ou distorções comuns de gravação (ex: fala rápido "gatei" em vez de "gastei", "deu 15 na manicure", "dentista amanhã 13:10", etc.).
- Interprete sempre a intenção semântica real do usuário com inteligência contextual!

REGRA DE OURO SOBRE ESCOPO:
- Se a legenda ou o áudio contiver expressamente palavras como "compartilhado", "compartilhada", "compartilhar", "para nós", "pra nós", "juntos", "do casal", "nossa", "nosso", "da casa", ou se a pessoa falar isso no final da frase (ex: "gastei 15 manicure compartilhado", "dentista amanhã 13:10 compartilhado", "comprar leite compartilhado"):
  O "scope" É OBRIGATORIAMENTE "SHARED"!
- Caso contrário, defina "PRIVATE".

DIRETRIZES DE RECONHECIMENTO:
1. GASTOS E COMPRAS (CREATE_EXPENSE):
   - Se for foto de comprovante Pix, recibo de máquina de cartão, cupom fiscal, fatura ou nota fiscal: extraia valor total, nome do estabelecimento e categoria.
   - Se for áudio onde a pessoa fala sobre um gasto, pagamento ou compra (ex: "Gatei 15 reais na manicure", "gastei 15 na manicure", "deu 15 na manicure", "Gastei 60 no mercado", "Almoço 35", "Farmácia 40"):
     - intent: "CREATE_EXPENSE"
     - amount: o valor numérico mencionado (ex: 15).
     - title: o que foi gasto (ex: "Manicure", "Mercado", "Almoço").
     - category: a categoria correspondente (HEALTH para manicure/beleza/saúde, RESTAURANT para refeições, FOOD_MARKET para mercado, etc.).

2. COMPROMISSOS E EVENTOS DE AGENDA (CREATE_EVENT):
   - Se o áudio for para agendar compromisso, consulta, dentista, médico ou reunião (ex: "Agendar dentista amanhã as 13:10", "Dentista amanhã às 13:10", "Marcar consulta amanhã às 14 horas", "Adicionar dentista na minha agenda"):
     - intent: "CREATE_EVENT"
     - title: título limpo do compromisso (ex: "Dentista", "Consulta médica", "Reunião").
     - startDate: data e hora ISO calculada com offset de Brasília UTC-3 a partir de ${referenceIso}.
     - endDate: 1 hora após startDate.
     - isAllDay: false se tiver horário, true se dia inteiro.

3. CONSULTAS (QUERY_CALENDAR, QUERY_TASKS, QUERY_SHOPPING_LIST):
   - Se o áudio perguntar pela agenda ou compromissos (ex: "o que tenho amanhã?", "minha agenda", "agenda dessa semana", "compromissos da semana"):
     - intent: "QUERY_CALENDAR"
     - queryPeriod: "tomorrow" (se perguntar de amanhã), "week" (se perguntar da semana ou próximos dias), "today" (se hoje ou não especificado).
   - Se o áudio perguntar por lembretes/tarefas: QUERY_TASKS.
   - Se o áudio perguntar pela lista de compras: QUERY_SHOPPING_LIST.

4. LISTA DE COMPRAS (CREATE_SHOPPING_ITEM):
   - Se o áudio listar itens para comprar (ex: "comprar leite, queijo e ovos").
   - items: array de itens com name e quantity.

5. METAS FINANCEIRAS E OBJETIVOS (CREATE_GOAL):
   - Se o áudio for sobre poupar, guardar dinheiro ou meta (ex: "Meta de 5000 para viagem").

6. LEMBRETES E TAREFAS (CREATE_TASK):
   - Se for áudio pedindo para lembrar de algo (ex: "lembrar de pagar condomínio dia 10").`;

      const promptContent = [
        prompt,
        {
          inlineData: {
            data: mediaBuffer.toString("base64"),
            mimeType: cleanMimeType,
          },
        },
      ];

      const parsed = await this.generateWithModelFallback(promptContent, now);
      if (parsed) {
        if (caption && /\b(?:compartilhad[ao]s?|compartilhar|pra nós|para nós|do casal|da casa|juntos)\b/i.test(caption)) {
          parsed.data.scope = RecordScope.SHARED;
        }
        if (parsed.data?.title && /\b(?:compartilhad[ao]s?|compartilhar)\b/i.test(parsed.data.title)) {
          parsed.data.scope = RecordScope.SHARED;
          parsed.data.title = parsed.data.title
            .replace(/\s*\b(?:compartilhad[ao]s?|compartilhar)\b\s*/gi, " ")
            .trim();
        }
        return parsed;
      }
    }

    if (caption) {
      return this.heuristicFallback(caption, now);
    }

    return {
      intent: AIIntent.UNKNOWN,
      confidence: 0.2,
      data: {
        title: "Mídia não identificada",
        scope: RecordScope.PRIVATE,
      },
    };
  }

  private heuristicFallback(text: string, now: Date): ParsedWhatsAppResultDto {
    const lower = text.toLowerCase();

    // Detecção de valores monetários (ex: 10.000, 10000, 45, 45.90, R$ 45,00, 150 reais, 15 reais)
    const sanitizedAmountText = text.replace(/(\d+)\.(\d{3})/g, "$1$2");
    const amountMatch =
      sanitizedAmountText.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|r\$)/i) ||
      sanitizedAmountText.match(/(?:r\$|reais)?\s*(\d+(?:[.,]\d{1,2})?)/i);
    const amount = amountMatch ? parseFloat((amountMatch[1] || amountMatch[0]).replace(",", ".")) : undefined;

    // Detecção de escopo estritamente por palavras explícitas
    const isShared =
      lower.includes("compartilhad") ||
      lower.includes("compartilhar") ||
      lower.includes("juntos") ||
      lower.includes("casal") ||
      lower.includes("para nós") ||
      lower.includes("pra nós") ||
      lower.includes("nossa") ||
      lower.includes("nosso");

    const scope = isShared ? RecordScope.SHARED : RecordScope.PRIVATE;

    // -1. CONSULTAS (QUERIES) VIA WHATSAPP
    // A. Consulta de Agenda
    const isAgendaQuery =
      (lower.includes("minha agenda") ||
        lower.includes("agenda de hoje") ||
        lower.includes("agenda para hoje") ||
        lower.includes("agenda pra hoje") ||
        lower.includes("agenda de amanhã") ||
        lower.includes("agenda de amanha") ||
        lower.includes("agenda pra amanhã") ||
        lower.includes("agenda pra amanha") ||
        lower.includes("agenda para amanhã") ||
        lower.includes("agenda para amanha") ||
        lower.includes("agenda da semana") ||
        lower.includes("agenda dessa semana") ||
        lower.includes("agenda desta semana") ||
        lower.includes("compromissos de hoje") ||
        lower.includes("compromissos para hoje") ||
        lower.includes("compromissos de amanhã") ||
        lower.includes("compromissos de amanha") ||
        lower.includes("compromissos da semana") ||
        lower.includes("compromissos dessa semana") ||
        /^me\s+(?:fale|mostre|diga|passe|mande|envie)\s+(?:a\s+)?agenda/i.test(lower) ||
        /^o\s+que\s+(?:eu\s+)?tenho\s+(?:na\s+agenda|para\s+hoje|pra\s+hoje|para\s+amanh[aã]|pra\s+amanh[aã]|amanh[aã]|essa\s+semana|esta\s+semana|na\s+semana|nesta\s+semana)/i.test(lower) ||
        /^quais\s+(?:são\s+)?(?:os\s+)?(?:meus\s+)?compromissos/i.test(lower)) &&
      !lower.includes("colocar") &&
      !lower.includes("adicionar") &&
      !lower.includes("agendar") &&
      !lower.includes("marcar") &&
      !lower.includes("criar") &&
      !lower.includes("novo evento");

    if (isAgendaQuery) {
      let queryPeriod: "today" | "tomorrow" | "week" | "specific_date" = "today";
      if (/\b(?:amanh[aã]|de\s+amanh[aã]|pra\s+amanh[aã]|para\s+amanh[aã])\b/i.test(lower)) {
        queryPeriod = "tomorrow";
      } else if (/\b(?:semana|dessa\s+semana|desta\s+semana|da\s+semana|esta\s+semana|pr[oó]ximos\s+dias)\b/i.test(lower)) {
        queryPeriod = "week";
      }

      return {
        intent: AIIntent.QUERY_CALENDAR,
        confidence: 0.95,
        data: {
          title: "Consulta de Agenda",
          scope,
          queryPeriod,
        },
      };
    }

    // B. Consulta de Lembretes / Tarefas
    if (
      lower.includes("meus lembretes") ||
      lower.includes("minhas tarefas") ||
      /^me\s+(?:fale|mostre|diga|passe)\s+(?:os\s+)?lembretes/i.test(lower) ||
      /^me\s+(?:fale|mostre|diga|passe)\s+(?:as\s+)?tarefas/i.test(lower) ||
      /^o\s+que\s+tenho\s+(?:para|pra)\s+fazer/i.test(lower) ||
      /^quais\s+(?:são\s+)?(?:os\s+)?(?:meus\s+)?lembretes/i.test(lower) ||
      /^quais\s+(?:são\s+)?(?:as\s+)?(?:minhas\s+)?tarefas/i.test(lower)
    ) {
      if (
        !lower.includes("lembrar de") &&
        !lower.includes("me lembre de") &&
        !lower.includes("adicionar") &&
        !lower.includes("criar")
      ) {
        return {
          intent: AIIntent.QUERY_TASKS,
          confidence: 0.95,
          data: {
            title: "Consulta de Lembretes",
            scope,
          },
        };
      }
    }

    // C. Consulta de Lista de Compras
    if (
      lower.includes("minha lista de compras") ||
      lower.includes("minha lista de mercado") ||
      /^me\s+(?:fale|mostre|diga|passe)\s+(?:a\s+)?lista\s+de\s+(?:compras|mercado)/i.test(lower) ||
      /^(?:ver|mostrar|qual\s+é\s+a)\s+lista\s+de\s+(?:compras|mercado)/i.test(lower) ||
      /^o\s+que\s+tem\s+(?:para|pra)\s+comprar/i.test(lower) ||
      /^o\s+que\s+preciso\s+comprar/i.test(lower)
    ) {
      if (
        !lower.includes("adicionar") &&
        !lower.includes("colocar") &&
        !lower.includes("bota") &&
        !lower.includes("botar") &&
        !lower.startsWith("comprar ")
      ) {
        return {
          intent: AIIntent.QUERY_SHOPPING_LIST,
          confidence: 0.95,
          data: {
            title: "Consulta de Lista de Compras",
            scope,
          },
        };
      }
    }

    // 0. PRIORIDADE: Detecção de Lista de Compras
    const isShoppingIntent =
      lower.includes("lista de compras") ||
      lower.includes("lista de mercado") ||
      lower.includes("adicionar na lista") ||
      lower.includes("colocar na lista") ||
      lower.includes("por na lista") ||
      lower.includes("pôr na lista") ||
      lower.includes("bota na lista") ||
      lower.includes("botar na lista") ||
      lower.includes("na lista") ||
      ((lower.startsWith("adicionar ") ||
        lower.startsWith("colocar ") ||
        lower.startsWith("bota ") ||
        lower.startsWith("botar ") ||
        lower.startsWith("comprar ")) &&
        amount === undefined &&
        !lower.includes("evento") &&
        !lower.includes("compromisso") &&
        !lower.includes("reuni") &&
        !lower.includes("meta") &&
        !lower.includes("lembr"));

    if (isShoppingIntent) {
      const clean = text
        .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+(?:na\s+|pra\s+|para\s+|no\s+)?(?:minha\s+)?(?:lista\s*(?:de\s*(?:compras|mercado))?)?\s*/gi, "")
        .replace(/\s*(?:na|pra|para|no)\s+(?:minha\s+)?lista\s*(?:de\s*(?:compras|mercado))?/gi, "")
        .replace(/^(?:adicionar|colocar|por|pôr|bota|botar|comprar|incluir)\s+/gi, "")
        .replace(/\s*\b(?:compartilhad[ao]s?|compartilhar)\b\s*$/gi, "")
        .trim();

      const rawItems = clean.split(/[\n,;•-]+/).map((s) => s.trim()).filter(Boolean);
      const items = (rawItems.length > 0 ? rawItems : [clean]).map((it) => ({
        name: it.charAt(0).toUpperCase() + it.slice(1),
        quantity: "1",
      }));

      const firstItemName = items[0]?.name || "Item";

      return {
        intent: AIIntent.CREATE_SHOPPING_ITEM,
        confidence: 0.9,
        data: {
          title: firstItemName,
          scope,
          items,
        },
      };
    }

    // 1. PRIORIDADE MÁXIMA: Detecção de Meta
    if (
      lower.includes("meta") ||
      lower.includes("guardar") ||
      lower.includes("poupar") ||
      lower.includes("objetivo")
    ) {
      let cleanTitle = text
        .replace(/^(?:adicionar|criar|nova)\s+/i, "")
        .replace(/\s*(?:na|pra|para|em)\s+meta(?:\s+com|\s+de)?.*$/i, "")
        .replace(/^meta\s*(?:de|para)?\s*/i, "")
        .replace(/(?:gasto\s+de|valor\s+de|r\$|\d+(?:[.,]\d+)?|reais|compartilhad[ao]|privad[ao])/gi, "")
        .trim();
      if (!cleanTitle) cleanTitle = "Nova Meta";

      return {
        intent: AIIntent.CREATE_GOAL,
        confidence: 0.9,
        data: {
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          amount: amount || 1000,
          scope,
        },
      };
    }

    // 1.5. Detecção de Compromisso / Evento de Calendário
    const isEventIntent =
      lower.includes("agendar") ||
      lower.includes("marcar") ||
      lower.includes("dentista") ||
      lower.includes("médico") ||
      lower.includes("medico") ||
      lower.includes("consulta") ||
      lower.includes("colocar evento") ||
      lower.includes("criar evento") ||
      lower.includes("adicionar evento") ||
      lower.includes("novo evento") ||
      lower.includes("reunião") ||
      lower.includes("reuniao") ||
      lower.includes("aniversário") ||
      lower.includes("aniversario") ||
      ((lower.includes("agenda") || lower.includes("evento")) &&
        (lower.includes("às") || lower.includes(" as ") || lower.includes("dia ")));

    if (isEventIntent) {
      const monthsMap: Record<string, number> = {
        janeiro: 0, jan: 0,
        fevereiro: 1, fev: 1,
        março: 2, marco: 2, mar: 2,
        abril: 3, abr: 3,
        maio: 4, mai: 4,
        junho: 5, jun: 5,
        julho: 6, jul: 6,
        agosto: 7, ago: 7,
        setembro: 8, set: 8,
        outubro: 9, out: 9,
        novembro: 10, nov: 10,
        dezembro: 11, dez: 11,
      };

      let year = now.getFullYear();
      let month = now.getMonth();
      let day = now.getDate() + 1;
      let hour = 9;
      let minute = 0;
      let foundDate = false;
      let foundTime = false;
      let isAllDay = true;

      // 1. "7 de outubro de 2026" ou "7 de outubro"
      const textDateMatch = lower.match(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/i);
      if (textDateMatch) {
        const d = parseInt(textDateMatch[1], 10);
        const mStr = textDateMatch[2].toLowerCase();
        const yStr = textDateMatch[3];
        if (monthsMap[mStr] !== undefined) {
          day = d;
          month = monthsMap[mStr];
          if (yStr) year = parseInt(yStr, 10);
          foundDate = true;
        }
      }

      // 2. "07/10/2026" ou "07/10" ou "dia 07/10"
      if (!foundDate) {
        const slashMatch = lower.match(/(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
        if (slashMatch) {
          day = parseInt(slashMatch[1], 10);
          month = parseInt(slashMatch[2], 10) - 1;
          if (slashMatch[3]) {
            let y = parseInt(slashMatch[3], 10);
            if (y < 100) y += 2000;
            year = y;
          }
          foundDate = true;
        }
      }

      // 3. "dia 15"
      if (!foundDate) {
        const dayOnlyMatch = lower.match(/dia\s+(\d{1,2})\b/i);
        if (dayOnlyMatch) {
          day = parseInt(dayOnlyMatch[1], 10);
          month = now.getMonth();
          year = now.getFullYear();
          foundDate = true;
        }
      }

      // 4. "hoje" ou "amanhã"
      if (!foundDate) {
        if (lower.includes("hoje")) {
          day = now.getDate();
          month = now.getMonth();
          year = now.getFullYear();
          foundDate = true;
        } else if (lower.includes("amanha") || lower.includes("amanhã")) {
          const tom = new Date(now.getTime() + 24 * 3600 * 1000);
          day = tom.getDate();
          month = tom.getMonth();
          year = tom.getFullYear();
          foundDate = true;
        }
      }

      // Horário: "às 17h", "às 17:30", "às 17h30", "17h", "17:30", "as 13:10"
      const timeMatch = lower.match(/(?:(?:às|as)\s+)?(\d{1,2})(?:h|:)(\d{2})?|(?:às|as)\s+(\d{1,2})h?/i);
      if (timeMatch) {
        if (timeMatch[1]) {
          hour = parseInt(timeMatch[1], 10);
          minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          foundTime = true;
          isAllDay = false;
        } else if (timeMatch[3]) {
          hour = parseInt(timeMatch[3], 10);
          minute = 0;
          foundTime = true;
          isAllDay = false;
        }
      }

      const eventDate = new Date(year, month, day, foundTime ? hour : 0, foundTime ? minute : 0, 0);
      const endDate = new Date(eventDate.getTime() + (isAllDay ? 24 * 3600 * 1000 : 60 * 60 * 1000));

      let cleanTitle = text;
      if (text.includes(" - ")) {
        cleanTitle = text.split(" - ").slice(1).join(" - ").trim();
      } else if (text.includes(" : ")) {
        cleanTitle = text.split(" : ").slice(1).join(" : ").trim();
      } else {
        cleanTitle = cleanTitle
          .replace(/^(?:colocar\s+evento\s+(?:na\s+minha\s+agenda)?|agendar\s+evento|agendar|marcar\s+evento|marcar|adicionar\s+(?:evento\s+)?(?:na\s+minha\s+agenda)?|criar\s+evento|novo\s+evento)\s*:?\s*/gi, "")
          .replace(/\b\d{1,2}\s+de\s+[a-zç]+(?:\s+de\s+\d{4})?/gi, "")
          .replace(/\b(?:dia\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/gi, "")
          .replace(/\bdia\s+\d{1,2}\b/gi, "")
          .replace(/(?:(?:às|as)\s+)?\d{1,2}(?:h|:\d{2})\b/gi, "")
          .replace(/(?:^|\s+)(?:hoje|amanhã|amanha)(?:\s+|$)/gi, " ")
          .replace(/(?:^|\s+)(?:na\s+minha\s+agenda)(?:\s+|$)/gi, " ")
          .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
          .trim();
      }
      if (!cleanTitle) cleanTitle = "Compromisso";

      return {
        intent: AIIntent.CREATE_EVENT,
        confidence: 0.9,
        data: {
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          startDate: eventDate.toISOString(),
          endDate: endDate.toISOString(),
          isAllDay,
          scope,
        },
      };
    }

    // 2. Detecção de Lembrete / Tarefa
    if (
      lower.startsWith("lembr") ||
      lower.includes("lembrar") ||
      lower.includes("pagar conta") ||
      lower.includes("compromisso") ||
      lower.includes("nao esquecer") ||
      lower.includes("daqui")
    ) {
      let dueDate: Date | undefined;
      let hasSpecificTime = false;

      // "daqui X minutos"
      const minMatch = lower.match(/daqui\s+(\d+)\s+min/i);
      if (minMatch) {
        const mins = parseInt(minMatch[1], 10);
        dueDate = new Date(now.getTime() + mins * 60 * 1000);
        hasSpecificTime = true;
      }

      // "daqui X horas"
      const hourMatch = lower.match(/daqui\s+(\d+)\s+h/i);
      if (hourMatch) {
        const hrs = parseInt(hourMatch[1], 10);
        dueDate = new Date(now.getTime() + hrs * 60 * 60 * 1000);
        hasSpecificTime = true;
      }

      // "dia DD/MM" ou "dia DD"
      const dateMatch = lower.match(/dia\s+(\d{1,2})(?:\/(\d{1,2}))?/i);
      if (dateMatch && !dueDate) {
        const day = parseInt(dateMatch[1], 10);
        const month = dateMatch[2] ? parseInt(dateMatch[2], 10) - 1 : now.getMonth();
        const year = now.getFullYear();

        const timeMatch = lower.match(/(?:às|as)\s+(\d{1,2})(?:h|:(\d{2}))?/i);
        if (timeMatch) {
          const h = parseInt(timeMatch[1], 10);
          const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          dueDate = new Date(year, month, day, h, m, 0);
          hasSpecificTime = true;
        } else {
          dueDate = new Date(year, month, day, 8, 0, 0);
          hasSpecificTime = false;
        }
      }

      let cleanTitle = text
        .replace(/^(?:me\s+)?lembr(?:ar|e|a)?\s*(?:de)?/i, "")
        .replace(/(?:daqui\s+\d+\s+min(?:utos)?|daqui\s+\d+\s+horas?)/gi, "")
        .trim();
      if (!cleanTitle) cleanTitle = text;

      return {
        intent: AIIntent.CREATE_TASK,
        confidence: 0.85,
        data: {
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
          dueDate: dueDate ? dueDate.toISOString() : undefined,
          hasSpecificTime,
          scope,
        },
      };
    }

    // 3. Detecção de Gasto
    if (amount !== undefined) {
      let category = ExpenseCategory.OTHER;
      if (lower.includes("mercado") || lower.includes("compras") || lower.includes("feira") || lower.includes("supermercado")) {
        category = ExpenseCategory.FOOD_MARKET;
      } else if (lower.includes("almoc") || lower.includes("jantar") || lower.includes("restaurante") || lower.includes("ifood") || lower.includes("lanche") || lower.includes("pizza") || lower.includes("cafe")) {
        category = ExpenseCategory.RESTAURANT;
      } else if (lower.includes("uber") || lower.includes("gasolina") || lower.includes("metro") || lower.includes("transporte") || lower.includes("onibus") || lower.includes("posto")) {
        category = ExpenseCategory.TRANSPORTATION;
      } else if (lower.includes("farmacia") || lower.includes("medico") || lower.includes("remedio") || lower.includes("manicure") || lower.includes("salao") || lower.includes("unha") || lower.includes("cabelo") || lower.includes("barba") || lower.includes("estetica")) {
        category = ExpenseCategory.HEALTH;
      } else if (lower.includes("luz") || lower.includes("agua") || lower.includes("internet") || lower.includes("energia") || lower.includes("aluguel") || lower.includes("condominio")) {
        category = ExpenseCategory.UTILITIES;
      }

      let title = text
        .replace(/(?:gastei|gatei|paguei|comprei|valor|r\$|\d+(?:[.,]\d{1,2})?|reais|compartilhad[ao]|privad[ao]|(?:na|no|em|pra|para)\s+)/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!title) title = "Gasto via WhatsApp";

      return {
        intent: AIIntent.CREATE_EXPENSE,
        confidence: 0.85,
        data: {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          amount,
          category,
          scope,
        },
      };
    }

    return {
      intent: AIIntent.UNKNOWN,
      confidence: 0.3,
      data: {
        title: text,
        scope: RecordScope.PRIVATE,
      },
    };
  }
}
