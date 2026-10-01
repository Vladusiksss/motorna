import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"МОТОРНА — ваш автомобіль, під контролем",description:"Запчастини, гараж та планування ремонту в одному просторі автовласника.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="uk"><body>{children}</body></html>}
