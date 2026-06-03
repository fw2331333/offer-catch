/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },

      },
      typography: {
        pretext: {
          css: {
            fontSize: "15px",
            lineHeight: "1.65",
            maxWidth: "none",
            color: "#374151",
            "--tw-prose-body": "#374151",
            "--tw-prose-headings": "#111827",
            "--tw-prose-bold": "#111827",
            "--tw-prose-links": "#2563eb",
            "--tw-prose-code": "#1f2937",
            p: { marginTop: "0.65em", marginBottom: "0.65em" },
            "p:first-child": { marginTop: 0 },
            "p:last-child": { marginBottom: 0 },
            h1: {
              fontSize: "1.35em",
              fontWeight: "600",
              letterSpacing: "-0.02em",
              marginTop: "1.1em",
              marginBottom: "0.45em",
            },
            h2: {
              fontSize: "1.15em",
              fontWeight: "600",
              letterSpacing: "-0.01em",
              marginTop: "1em",
              marginBottom: "0.4em",
            },
            h3: {
              fontSize: "1.05em",
              fontWeight: "600",
              marginTop: "0.85em",
              marginBottom: "0.35em",
            },
            ul: { paddingLeft: "1.35em", marginTop: "0.5em", marginBottom: "0.5em" },
            ol: { paddingLeft: "1.35em", marginTop: "0.5em", marginBottom: "0.5em" },
            li: { marginTop: "0.2em", marginBottom: "0.2em" },
            "li > p": { marginTop: "0.25em", marginBottom: "0.25em" },
            code: {
              fontSize: "0.88em",
              fontWeight: "500",
              backgroundColor: "rgba(0,0,0,0.06)",
              padding: "0.12em 0.35em",
              borderRadius: "4px",
            },
            "code::before": { content: '""' },
            "code::after": { content: '""' },
            pre: {
              fontSize: "0.88em",
              lineHeight: "1.55",
              borderRadius: "0.5rem",
              padding: "0.85em 1em",
              backgroundColor: "#1f2937",
              color: "#f3f4f6",
            },
            "pre code": {
              backgroundColor: "transparent",
              padding: 0,
              fontWeight: "400",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
