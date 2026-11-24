import './styles/main.css';
import './styles/auth.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/appointments.css';
import './styles/staffAppointmentBooking.css';
import './styles/clients.css';
import './styles/services.css';
import './styles/professionals.css';
import './styles/professionalConfiguration.css';
import './styles/clientPortal.css';
import './styles/professionalPortal.css';
import { createElement } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx';

const appRoot = document.querySelector('#app');
ReactDOM.createRoot(appRoot).render(createElement(App));
