import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const port = Number(SMTP_PORT) || 587;
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    } else {
      this.logger.warn('SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). E-mails serão apenas logados.');
    }
  }

  get isConfigured() {
    return !!this.transporter;
  }

  async sendPasswordResetCode(to: string, name: string, code: string) {
    const subject = 'Seu código para redefinir a senha do Harry';
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0B0D12;color:#fff;border-radius:16px">
        <h2 style="margin:0 0 8px">Harry</h2>
        <p>Olá, ${name}!</p>
        <p>Use o código abaixo para redefinir sua senha. Ele vale por 15 minutos.</p>
        <p style="font-size:34px;font-weight:800;letter-spacing:8px;background:#161A22;padding:16px;text-align:center;border-radius:12px;color:#0A84FF">${code}</p>
        <p style="color:#8B93A1;font-size:12px">Se você não solicitou, ignore este e-mail.</p>
      </div>`;

    if (!this.transporter) {
      this.logger.warn(`[E-MAIL SIMULADO] Para: ${to} | Código: ${code}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || `Harry <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: `Seu código de redefinição de senha do Harry: ${code} (válido por 15 minutos).`,
      });
      this.logger.log(`E-mail de recuperação enviado para ${to}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${(err as Error).message}`);
    }
  }
}
