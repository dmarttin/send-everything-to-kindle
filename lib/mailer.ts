import nodemailer from "nodemailer";

type SendResult = {
  sent: boolean;
  message: string;
};

type SendPayload = {
  to: string | null;
  filename: string;
  buffer: Buffer;
  title: string;
  sourceUrl: string;
};

export async function sendToKindle(payload: SendPayload): Promise<SendResult> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM;

  if (!smtpUrl || !from) {
    return { sent: false, message: "SMTP not configured." };
  }

  if (!payload.to) {
    return { sent: false, message: "No Kindle email provided." };
  }

  const transporter = nodemailer.createTransport(smtpUrl);

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: "Send to Kindle",
    text: `Source: ${payload.sourceUrl}`,
    attachments: [
      {
        filename: payload.filename,
        content: payload.buffer,
      },
    ],
  });

  return { sent: true, message: "Sent to Kindle." };
}
