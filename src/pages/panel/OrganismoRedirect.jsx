import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * REP-3747 (decisión 2A de Matías, 29/10): el panel vive en /panel. /organismo, la dirección del diseño de Iván y
 * de la landing de Municipios (REP-3830), lleva ahí.
 */
export const OrganismoRedirect = () => <Navigate to="/panel" replace />;

export default OrganismoRedirect;
