import { html } from "hono/html";

interface ErrorTemplateProps {
  title: string;
  message: string;
  statusCode: number;
  details?: string;
}

export function ErrorTemplate({
  title,
  message,
  statusCode,
  details,
}: ErrorTemplateProps) {
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} - Oracode Preview</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com?v=4"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
                },
                colors: {
                  background: "oklch(0.18 0.002 240)",
                  foreground: "oklch(0.985 0 0)",
                  card: "oklch(0.21 0.002 240)",
                  "card-foreground": "oklch(0.985 0 0)",
                  border: "oklch(1 0 0 / 8%)",
                  muted: "oklch(0.22 0.003 240)",
                  "muted-foreground": "oklch(0.65 0.005 240)",
                  destructive: "oklch(0.6379 0.2372 25.22)",
                  "destructive-foreground": "oklch(1 0 0)",
                },
                borderRadius: {
                  lg: "0.625rem",
                },
              },
            },
          };
        </script>
        <style>
          body {
            font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
          }
        </style>
      </head>
      <body
        class="bg-background font-sans text-foreground antialiased min-h-screen flex items-center justify-center p-4"
      >
        <div
          class="w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg p-8"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex-shrink-0 w-12 h-12 rounded-lg ${statusCode >= 500
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"} flex items-center justify-center text-xl font-semibold"
            >
              ${statusCode}
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-2xl font-semibold text-foreground mb-2">
                ${title}
              </h1>
              <p class="text-muted-foreground mb-4">${message}</p>
              ${details
                ? html`<div
                    class="bg-muted rounded-lg p-4 text-sm font-mono text-muted-foreground overflow-x-auto"
                  >
                    <pre class="whitespace-pre-wrap break-words">
${details}</pre
                    >
                  </div>`
                : ""}
            </div>
          </div>
          <div class="mt-6 pt-6 border-t border-border">
            <p class="text-sm text-muted-foreground">
              Oracode Preview • Need help? Check your
              <a href="#" class="text-foreground hover:underline"
                >project settings</a
              >
            </p>
          </div>
        </div>
      </body>
    </html>`;
}

interface LoadingTemplateProps {
  title: string;
  message: string;
  status?: string;
}

export function LoadingTemplate({
  title,
  message,
  status,
}: LoadingTemplateProps) {
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="refresh" content="3" />
        <title>${title} - Oracode Preview</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com?v=4"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
                },
                colors: {
                  background: "oklch(0.18 0.002 240)",
                  foreground: "oklch(0.985 0 0)",
                  card: "oklch(0.21 0.002 240)",
                  "card-foreground": "oklch(0.985 0 0)",
                  border: "oklch(1 0 0 / 8%)",
                  muted: "oklch(0.22 0.003 240)",
                  "muted-foreground": "oklch(0.65 0.005 240)",
                  primary: "oklch(0.923 0.003 48.717)",
                },
                borderRadius: {
                  lg: "0.625rem",
                },
                animation: {
                  spin: "spin 1s linear infinite",
                },
                keyframes: {
                  spin: {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                },
              },
            },
          };
        </script>
        <style>
          body {
            font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
          }
        </style>
      </head>
      <body
        class="bg-background text-foreground antialiased min-h-screen flex items-center justify-center p-4"
      >
        <div
          class="w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg p-8 text-center"
        >
          <div
            class="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-6"
          ></div>
          <h1 class="text-2xl font-semibold text-foreground mb-2">${title}</h1>
          <p class="text-muted-foreground mb-4">${message}</p>
          ${status
            ? html`<div
                class="inline-block bg-muted rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                Status: ${status}
              </div>`
            : ""}
        </div>
      </body>
    </html>`;
}
