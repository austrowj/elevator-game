import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {
    
    // Display environment variable
    const buildInfo = document.createElement('div');
    const buildDate = import.meta.env.VITE_BUILD_DATE ? import.meta.env.VITE_BUILD_DATE.split('T')[0] : 'N/A';
    buildInfo.textContent = `Latest build on: ${buildDate}`;
    document.body.appendChild(buildInfo);

    StartGame('game-container');

});