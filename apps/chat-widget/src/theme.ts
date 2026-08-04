import {createTheme} from '@mui/material/styles';

export const theme = createTheme({
    palette:{
        mode: 'light',
        background:{
            default: '#fafafa',
            paper:'#ffffff',
        },
        primary:{
            main: '#3b5a7a',
        },
        text:{
            primary: '#1f2937',
            secondary:'#6b7280',
        },
        divider:'#e5e7eb',
    },
    typography:{
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            'sans-serif',
        ].join(','),
        fontSize: 14,
        h6:{
            fontWeight:600,
        },
    },
    shape:{
        borderRadius:8,
    },
    components:{
        MuiAppBar:{
            styleOverrides:{
                root:{
                    textTransform:'none',
                },
            },
        },
        MuiButton:{
            styleOverrides:{
                root:{
                    textTransform:'none',
                },
            },
        },
    },
});