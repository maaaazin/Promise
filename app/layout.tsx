import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit } from "@copilotkit/react-core";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = { title: "Promise", description: "Commitment intelligence for the conversations where work happens." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 dark:bg-[#0E1116] dark:text-[#edf0f8] transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit">{children}</CopilotKit>
        </ThemeProvider>
      </body>
    </html>
  );
}
