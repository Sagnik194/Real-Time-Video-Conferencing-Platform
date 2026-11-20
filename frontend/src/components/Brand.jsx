import React from 'react';
import '../App.css';

export default function Brand({ large = false, className = '' }) {
    return <span className={`smeet-brand${large ? ' smeet-brand--large' : ''}${className ? ` ${className}` : ''}`}>
        <img src="/smeet-logo.svg" alt="" aria-hidden="true" />
        <span>Smeet</span>
    </span>;
}
