// VibePub Email Service (via Resend)

const FROM_EMAIL = 'VibePub <no-reply@vibepub.dev>';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface ResendResponse {
  id?: string;
  error?: string;
  message?: string;
}

export async function sendEmail(apiKey: string, options: SendEmailOptions): Promise<ResendResponse> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      ...(options.text && { text: options.text }),
      ...(options.replyTo && { reply_to: options.replyTo }),
    }),
  });

  return res.json() as Promise<ResendResponse>;
}

// ─── Email Templates ───

export function buildSubmissionApprovedEmail(appName: string, slug: string): SendEmailOptions {
  return {
    subject: `✅ Your app "${appName}" has been approved — VibePub`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0a0a1a; color: #e0e0e0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 2.5rem;">🍺</span>
          <h1 style="font-size: 1.5rem; color: #fff; margin: 8px 0;">VibePub</h1>
        </div>
        <div style="background: #1a1a3e; border: 1px solid #2a2a4e; border-radius: 12px; padding: 24px;">
          <h2 style="color: #4caf50; margin-top: 0;">✅ App Approved!</h2>
          <p>Great news! Your app <strong style="color: #fff;">${appName}</strong> has passed all checks and is now live on VibePub.</p>
          <div style="margin: 20px 0;">
            <a href="https://${slug}.vibepub.dev" style="display: inline-block; padding: 12px 24px; background: #6c63ff; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">🚀 Open Your App</a>
            <a href="https://vibepub.dev/app.html?slug=${slug}" style="display: inline-block; padding: 12px 24px; background: transparent; color: #6c63ff; text-decoration: none; border-radius: 8px; font-weight: 500; border: 1px solid #6c63ff; margin-left: 8px;">View Listing</a>
          </div>
          <p style="color: #9090b0; font-size: 0.9rem;">Your app is now discoverable by users browsing VibePub and by AI assistants.</p>
        </div>
        <p style="text-align: center; color: #606080; font-size: 0.8rem; margin-top: 24px;">
          🍺 VibePub — The Open Web App Store<br>
          <a href="https://vibepub.dev" style="color: #6c63ff;">vibepub.dev</a>
        </p>
      </div>
    `,
    text: `Your app "${appName}" has been approved and is now live on VibePub!\n\nOpen your app: https://${slug}.vibepub.dev\nView listing: https://vibepub.dev/app.html?slug=${slug}\n\n— VibePub`,
  };
}

export function buildSubmissionRejectedEmail(appName: string, reason: string, checklist: string): SendEmailOptions {
  return {
    subject: `❌ Your app "${appName}" needs changes — VibePub`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0a0a1a; color: #e0e0e0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 2.5rem;">🍺</span>
          <h1 style="font-size: 1.5rem; color: #fff; margin: 8px 0;">VibePub</h1>
        </div>
        <div style="background: #1a1a3e; border: 1px solid #2a2a4e; border-radius: 12px; padding: 24px;">
          <h2 style="color: #f44336; margin-top: 0;">❌ App Needs Changes</h2>
          <p>Your app <strong style="color: #fff;">${appName}</strong> didn't pass our automated checks.</p>
          <div style="background: #12122a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #ff9800; font-weight: 500;">Reason:</p>
            <p style="margin: 0; color: #e0e0e0;">${reason}</p>
          </div>
          <div style="background: #12122a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #ff9800; font-weight: 500;">Checklist:</p>
            <pre style="margin: 0; color: #9090b0; font-size: 0.85rem; white-space: pre-wrap;">${checklist}</pre>
          </div>
          <p style="color: #9090b0; font-size: 0.9rem;">Fix the issues above and resubmit your app. Need help? Check our <a href="https://github.com/AshleyTechHK/vibepub" style="color: #6c63ff;">docs</a>.</p>
        </div>
        <p style="text-align: center; color: #606080; font-size: 0.8rem; margin-top: 24px;">
          🍺 VibePub — The Open Web App Store<br>
          <a href="https://vibepub.dev" style="color: #6c63ff;">vibepub.dev</a>
        </p>
      </div>
    `,
    text: `Your app "${appName}" didn't pass our automated checks.\n\nReason: ${reason}\n\nChecklist:\n${checklist}\n\nFix the issues and resubmit.\n\n— VibePub`,
  };
}

export function buildWelcomeEmail(displayName: string): SendEmailOptions {
  return {
    subject: `Welcome to VibePub, ${displayName}! 🍺`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0a0a1a; color: #e0e0e0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 2.5rem;">🍺</span>
          <h1 style="font-size: 1.5rem; color: #fff; margin: 8px 0;">Welcome to VibePub!</h1>
        </div>
        <div style="background: #1a1a3e; border: 1px solid #2a2a4e; border-radius: 12px; padding: 24px;">
          <p>Hey <strong style="color: #fff;">${displayName}</strong>! 👋</p>
          <p>You're all set to publish web apps on VibePub — the open web app store for the AI generation.</p>
          <h3 style="color: #fff; margin-top: 20px;">What you can do:</h3>
          <ul style="color: #9090b0; line-height: 1.8;">
            <li>📱 Submit your web apps from your <a href="https://vibepub.dev/dashboard.html" style="color: #6c63ff;">Dashboard</a></li>
            <li>🔒 Automated security scanning on every submission</li>
            <li>🌐 Get your own <code style="background: #12122a; padding: 2px 6px; border-radius: 4px;">yourapp.vibepub.dev</code> subdomain</li>
            <li>🤖 AI-powered discovery by ChatGPT, Claude, and more</li>
          </ul>
          <div style="margin: 20px 0;">
            <a href="https://vibepub.dev/dashboard.html" style="display: inline-block; padding: 12px 24px; background: #6c63ff; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">Go to Dashboard</a>
          </div>
        </div>
        <p style="text-align: center; color: #606080; font-size: 0.8rem; margin-top: 24px;">
          🍺 VibePub — The Open Web App Store<br>
          <a href="https://vibepub.dev" style="color: #6c63ff;">vibepub.dev</a>
        </p>
      </div>
    `,
    text: `Welcome to VibePub, ${displayName}!\n\nYou're all set to publish web apps. Head to your dashboard to submit your first app:\nhttps://vibepub.dev/dashboard.html\n\n— VibePub`,
  };
}
