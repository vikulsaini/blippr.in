function resendReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function canSendEmail() {
  return resendReady();
}

export async function sendVerificationEmail(email, code) {
  if (!resendReady()) {
    console.warn('Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM to send verification emails.');
    return { sent: false, reason: 'email_not_configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your Varta email',
      text: `Your Varta verification code is ${code}. It expires in 10 minutes.`
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error('Could not send verification email');
    error.status = 502;
    error.details = errorText;
    throw error;
  }

  return { sent: true };
}
