import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext';
import Brand from '../components/Brand';

function HomeComponent() {


    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [error, setError] = useState("");


    const {addToUserHistory, handleLogout} = useContext(AuthContext);
    let handleJoinVideoCall = async () => {
        const code = meetingCode.trim();
        if (!code) { setError("Enter a meeting code to join."); return; }
        try {
            await addToUserHistory(code);
            navigate(`/${encodeURIComponent(code)}`);
        } catch (e) {
            setError(e.response?.data?.message || "Unable to save meeting history. Please sign in again.");
        }
    }

    return (
        <>

            <div className="navBar">
                <div><Brand /></div>
                <div className="nav-actions">
                    <IconButton aria-label="Meeting history" onClick={
                        () => {
                            navigate("/history")
                        }
                    }>
                        <RestoreIcon />
                    </IconButton>
                    <Button onClick={async () => {
                        try { await handleLogout(); } catch { /* The local token is still cleared by handleLogout. */ }
                        navigate("/auth");
                    }} className="nav-logout">
                        Logout
                    </Button>
                </div>


            </div>


            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <p className="home-eyebrow">Your next conversation starts here</p>
                        <h2>Meet from anywhere.<br /><span>Feel right there.</span></h2>
                        <div className="join-meeting-form">
                            <TextField value={meetingCode} onChange={e => { setMeetingCode(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleJoinVideoCall()} id="outlined-basic" label="Meeting code" variant="outlined" />
                            <Button onClick={handleJoinVideoCall} variant='contained'>Join meeting</Button>
                        </div>
                        {error && <p role="alert">{error}</p>}
                        <div className="home-points"><span>HD video calls</span><span>Private rooms</span><span>Easy to join</span></div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="A video meeting preview" />
                </div>
            </div>
        </>
    )
}


export default withAuth(HomeComponent)
