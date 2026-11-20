import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';

export default function LandingPage() {
    const navigate = useNavigate();

    return <main className="landingPageContainer">
        <nav aria-label="Main navigation">
            <Link to="/" aria-label="Smeet home"><Brand /></Link>
            <div className="navlist">
                <button type="button" onClick={() => navigate('/aljk23')}>Join as guest</button>
                <button type="button" onClick={() => navigate('/auth')}>Register</button>
                <button type="button" className="nav-primary" onClick={() => navigate('/auth')}>Log in</button>
            </div>
        </nav>

        <section className="landingMainContainer">
            <div className="landing-copy">
                <div className="eyebrow">Meet face to face</div>
                <h1>Good talks.<br /><span>Better together.</span></h1>
                <p>Bring your people closer with simple, clear video calls. Create a room, share a link, and let the conversation flow.</p>
                <div className="landing-actions">
                    <Link to="/auth">Get started <span aria-hidden="true">→</span></Link>
                    <button type="button" onClick={() => navigate('/aljk23')}>Join as guest</button>
                </div>
                <div className="landing-note"><span aria-hidden="true">●</span> Video, voice and screen sharing in one place</div>
            </div>
            <div className="landing-art"><img src="/mobile.png" alt="A preview of a Smeet video call" /></div>
        </section>
    </main>;
}
