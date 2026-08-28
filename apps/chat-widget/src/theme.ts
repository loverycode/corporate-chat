import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
    const isDark = mode === 'dark';
    return createTheme({
        palette: {
            mode,
            background: {
                default: isDark ? '#121417' : '#fafafa',
                paper: isDark ? '#1c1f24' : '#ffffff',
            },
            primary: {
                main: isDark ? '#5b82ab' : '#3b5a7a',
            },
            text: {
                primary: isDark ? '#e5e7eb' : '#1f2937',
                secondary: isDark ? '#9ca3af' : '#6b7280',
            },
            divider: isDark ? '#2a2e35' : '#e5e7eb',
        },
        typography: {
            fontFamily: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'].join(','),
            fontSize: 14,
            h6: { fontWeight: 600 },
        },
        shape: { borderRadius: 8 },
        components: {
            MuiAppBar: { styleOverrides: { root: { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } } },
            MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
        },
    });
}