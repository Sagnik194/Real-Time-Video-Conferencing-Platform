import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';
import Brand from '../components/Brand';



// TODO remove, this demo shouldn't need to reset the theme.

const defaultTheme = createTheme({ palette: { primary: { main: '#e62117' }, secondary: { main: '#e62117' } }, shape: { borderRadius: 12 } });

export default function Authentication() {

    

    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [name, setName] = React.useState('');
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');


    const [formState, setFormState] = React.useState(0);

    const [open, setOpen] = React.useState(false)


    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    let handleAuth = async () => {
        try {
            if (formState === 0) {

                await handleLogin(username, password)

            }
            if (formState === 1) {
                const result = await handleRegister(name, username, password);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("")
                setFormState(0)
                setPassword("")
            }
        } catch (err) {

            let message = err.response?.data?.message || "Unable to complete the request. Please try again.";
            setError(message);
        }
    }


    return (
        <ThemeProvider theme={defaultTheme}>
            <Grid container component="main" className="auth-page" sx={{ minHeight: '100vh' }}>
                <CssBaseline />
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={7}
                    className="auth-showcase"
                    sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: { sm: 4, md: 7 } }}
                >
                    <Brand large />
                    <div className="auth-showcase-copy"><span className="eyebrow">A little closer</span><h1>Make room for<br />good conversations.</h1><p>Meet, share and catch up with your people wherever they are.</p><img src="/mobile.png" alt="Smeet video call preview" /></div>
                    <p className="auth-showcase-foot">Smeet · Video calls made simple</p>
                </Grid>
                <Grid item xs={12} sm={8} md={5} component={Paper} elevation={0} square className="auth-form-panel">
                    <Box
                        sx={{
                            my: { xs: 5, sm: 8 },
                            mx: { xs: 3, sm: 5, md: 7 },
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <div className="auth-mobile-brand"><Brand /></div>
                        <Avatar sx={{ m: 1, bgcolor: '#fff0ee', color: 'primary.main', width: 54, height: 54 }}><LockOutlinedIcon /></Avatar>
                        <h1 className="auth-heading">Welcome to Smeet</h1>
                        <p className="auth-subheading">Sign in or create an account to get started.</p>


                        <div>
                            <Button variant={formState === 0 ? "contained" : "text"} onClick={() => { setFormState(0); setError(''); }}>
                                Sign In
                            </Button>
                            <Button variant={formState === 1 ? "contained" : "text"} onClick={() => { setFormState(1); setError(''); }}>
                                Sign Up
                            </Button>
                        </div>

                        <Box component="form" noValidate sx={{ mt: 1 }}>
                            {formState === 1 ? <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="full-name"
                                label="Full name"
                                name="name"
                                value={name}
                                autoFocus
                                onChange={(e) => setName(e.target.value)}
                            /> : <></>}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                autoFocus
                                onChange={(e) => setUsername(e.target.value)}

                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}

                                id="password"
                            />

                            <p style={{ color: "red" }}>{error}</p>

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2, py: 1.4, borderRadius: 3, textTransform: 'none', fontWeight: 750 }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? "Sign in" : "Create account"}
                            </Button>

                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Snackbar

                open={open}
                autoHideDuration={4000}
                message={message}
            />

        </ThemeProvider>
    );
}
