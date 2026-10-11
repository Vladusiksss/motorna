import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./interface-refresh.css";
export const metadata: Metadata = {title:"МОТОРНА — пошук автозапчастин за VIN, гараж і СТО",description:"Знайдіть запчастини, зберігайте авто в гаражі та обирайте СТО по всій Україні. Все в одному місці.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#123f6c"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="uk"><body>{children}</body></html>}

