function twilioReady() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export function canSendSms() {
  return twilioReady();
}

export async function sendOtpSms(phone, otp) {
  if (!twilioReady()) {
    console.warn('SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to send OTP messages.');
    return { sent: false, reason: 'sms_not_configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    To: phone,
    From: process.env.TWILIO_FROM_NUMBER,
    Body: `Your Varta OTP is ${otp}. It expires in 5 minutes.`
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error('Could not send OTP SMS');
    error.status = 502;
    error.details = errorText;
    throw error;
  }

  return { sent: true };
}
