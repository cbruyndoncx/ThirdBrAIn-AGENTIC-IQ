import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { AppProps } from 'next/app'
import Head from 'next/head'
import React from 'react'
import { Provider } from 'react-redux'
import store from '../store/store'
import '../styles/globals.css'

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
    return (
        <Provider store={store}>
            <Head>
                <link rel="icon" type="image/png" href="/pyspur-black.png" media="(prefers-color-scheme: light)" />
                <link rel="icon" type="image/png" href="/pyspur-white.png" media="(prefers-color-scheme: dark)" />
            </Head>
            <HeroUIProvider>
                <NextThemesProvider attribute="class" defaultTheme="system">
                    <Component {...pageProps} />
                </NextThemesProvider>
            </HeroUIProvider>
        </Provider>
    )
}

export default MyApp
