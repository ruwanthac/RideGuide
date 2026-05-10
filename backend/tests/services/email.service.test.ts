jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('email.service', () => {
  const smtpSendMailMock = jest.fn();

  beforeEach(async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;

    smtpSendMailMock.mockReset();
    smtpSendMailMock.mockResolvedValue({ messageId: '<smtp-msg@host>' });

    const nodemailer = await import('nodemailer');
    (nodemailer.createTransport as jest.Mock).mockImplementation(() => ({
      sendMail: smtpSendMailMock,
    }));
  });

  it('returns skipped and warns once when SMTP is not configured', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const { sendEmail, isEmailConfigured } = await import('../../src/services/email.service');

    expect(isEmailConfigured()).toBe(false);

    const first = await sendEmail({ to: 'a@b.com', subject: 'S', html: '<p>x</p>' });
    const second = await sendEmail({ to: 'a@b.com', subject: 'S', html: '<p>x</p>' });

    expect(first).toEqual({ ok: false, skipped: true });
    expect(second).toEqual({ ok: false, skipped: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(smtpSendMailMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sends via SMTP when configured (Brevo-style)', async () => {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
    process.env.SMTP_USER = 'login@smtp-brevo.com';
    process.env.SMTP_PASS = 'secret';
    process.env.EMAIL_FROM = 'RideGuide <hello@example.com>';

    const { sendEmail, isEmailConfigured } = await import('../../src/services/email.service');
    const nodemailer = await import('nodemailer');

    expect(isEmailConfigured()).toBe(true);

    const r = await sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
      text: 'Body',
      replyTo: 'support@example.com',
    });

    expect(r).toEqual({ ok: true, id: 'smtp-msg@host' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'login@smtp-brevo.com', pass: 'secret' },
    });
    expect(smtpSendMailMock).toHaveBeenCalledWith({
      from: 'RideGuide <hello@example.com>',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Body</p>',
      text: 'Body',
      replyTo: 'support@example.com',
    });
  });

  it('is not configured when SMTP password is missing', async () => {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
    process.env.SMTP_USER = 'u';
    process.env.EMAIL_FROM = 'A <a@b.com>';

    const { isEmailConfigured, sendEmail } = await import('../../src/services/email.service');

    expect(isEmailConfigured()).toBe(false);
    const r = await sendEmail({ to: 't@b.com', subject: 'S', html: '<p>x</p>' });
    expect(r).toEqual({ ok: false, skipped: true });
    expect(smtpSendMailMock).not.toHaveBeenCalled();
  });

  it('throws when sendMail rejects', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.EMAIL_FROM = 'App <a@b.com>';
    smtpSendMailMock.mockRejectedValue(new Error('SMTP refused'));

    const { sendEmail } = await import('../../src/services/email.service');

    await expect(sendEmail({ to: 't@b.com', subject: 'S', html: '<p>x</p>' })).rejects.toThrow('SMTP refused');
  });
});
