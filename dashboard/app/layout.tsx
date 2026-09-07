import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Manager",
  description: "Review, schedule and publish AI-made Instagram reels.",
};

const themeScript =
  "(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
