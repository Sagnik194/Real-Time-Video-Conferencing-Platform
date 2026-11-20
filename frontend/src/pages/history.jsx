import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

import { IconButton } from '@mui/material';
import Brand from '../components/Brand';
export default function History() {


    const { getHistoryOfUser } = useContext(AuthContext);

    const [meetings, setMeetings] = useState([])


    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch {
                // IMPLEMENT SNACKBAR
            }
        }

        fetchHistory();
    }, [getHistoryOfUser])

    let formatDate = (dateString) => {

        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();

        return `${day}/${month}/${year}`

    }

    return (
        <main className="history-page">
            <header className="history-header">
                <IconButton aria-label="Back to Smeet home" onClick={() => routeTo("/home")}><HomeIcon /></IconButton>
                <Brand />
            </header>
            <section className="history-content">
                <h1>Meeting history</h1>
                <p className="history-intro">Your recent rooms are kept here for a quick return.</p>
                {meetings.length ? <div className="history-list">{meetings.map((meeting, index) => <Card key={meeting._id || `${meeting.meetingCode}-${index}`} className="history-card" variant="outlined">
                    <CardContent>
                        <Typography className="history-code" variant="body1">Room code · {meeting.meetingCode}</Typography>
                        <Typography className="history-date" variant="body2">{formatDate(meeting.date)}</Typography>
                    </CardContent>
                </Card>)}</div> : <div className="history-empty">No meetings yet. Join a room and your recent meetings will appear here.</div>}
            </section>
        </main>
    )
}
