import type { Metadata } from "next";
import "./globals.css";
import "./interface-refresh.css";
export const metadata: Metadata = {title:"МОТОРНА — пошук автозапчастин за VIN, гараж і СТО",description:"Знайдіть запчастини, зберігайте авто в гаражі та обирайте СТО Києва й області. Все в одному місці.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="uk"><body>{children}</body></html>}

