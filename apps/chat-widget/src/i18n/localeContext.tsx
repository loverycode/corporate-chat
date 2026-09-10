/* eslint-disable react-refresh/only-export-components */
import {createContext, useContext} from 'react';
import {translations, type Locale, type TranslationKey} from './translations';

interface LocaleContextValue{
    locale: Locale;
    t:(key: TranslationKey)=>string;
}

const LocaleContext = createContext<LocaleContextValue>({
    locale: 'ru',
    t:(key)=>translations.ru[key]
});

export function LocaleProvider({locale, children}: {locale: Locale; children: React.ReactNode}){
    const t=(key: TranslationKey)=>translations[locale][key];
    return <LocaleContext.Provider value={{locale, t}}>{children}</LocaleContext.Provider>
}

export function useTranslation(){
    return useContext(LocaleContext);
}