// Dataset de Reportes de Prueba Georreferenciados para CABA y Avellaneda (REP-2600)

export const MOCK_REPORTS = [
  {
    id: 'REP-101',
    title: 'Bache profundo en calzada principal',
    category: 'Infraestructura vial',
    categoryIcon: 'car_crash',
    status: 'En curso',
    statusColor: 'bg-[#FFF6E9] text-[#E08A00] border-[#FCE2B6]',
    pinColor: '#E08A00',
    coordinates: [-58.3816, -34.6037], // San Nicolás / Obelisco
    address: 'Av. Corrientes 1050, San Nicolás',
    date: '24 Ago 2026',
    description: 'Bache de gran tamaño que dificulta el tránsito vehicular y puede dañar neumáticos.',
  },
  {
    id: 'REP-102',
    title: 'Luminaria pública parpadeando',
    category: 'Alumbrado público',
    categoryIcon: 'lightbulb',
    status: 'Enviado',
    statusColor: 'bg-[#EEF5FC] text-[#1E6FCB] border-[#CFE4FA]',
    pinColor: '#1E6FCB',
    coordinates: [-58.4201, -34.6158], // Almagro / Boedo
    address: 'Av. Medrano 420, Almagro',
    date: '26 Ago 2026',
    description: 'Columna de alumbrado parpadea constantemente durante la noche dejando la vereda a oscuras.',
  },
  {
    id: 'REP-103',
    title: 'Contenedor de residuos desbordado',
    category: 'Higiene urbana',
    categoryIcon: 'delete',
    status: 'Resuelto',
    statusColor: 'bg-[#E3F5EC] text-[#2E9E6B] border-[#C3EBD7]',
    pinColor: '#2E9E6B',
    coordinates: [-58.4452, -34.5711], // Belgrano / Colegiales
    address: 'Av. Cabildo 1820, Belgrano',
    date: '15 Ago 2026',
    description: 'El contenedor de basura se encontraba saturado y fue vaciado por el servicio municipal.',
  },
  {
    id: 'REP-104',
    title: 'Semáforo fuera de servicio',
    category: 'Tránsito y semáforos',
    categoryIcon: 'traffic',
    status: 'En curso',
    statusColor: 'bg-[#FFF6E9] text-[#E08A00] border-[#FCE2B6]',
    pinColor: '#E08A00',
    coordinates: [-58.3662, -34.6624], // Avellaneda Centro / Mitre
    address: 'Av. Bartolomé Mitre 650, Avellaneda',
    date: '27 Ago 2026',
    description: 'Semáforo en intermitente en intersección de alto caudal vehicular.',
  },
  {
    id: 'REP-105',
    title: 'Árbol con ramas caídas sobre vereda',
    category: 'Espacios verdes',
    categoryIcon: 'park',
    status: 'Resuelto',
    statusColor: 'bg-[#E3F5EC] text-[#2E9E6B] border-[#C3EBD7]',
    pinColor: '#2E9E6B',
    coordinates: [-58.4115, -34.5826], // Palermo
    address: 'Av. Coronel Díaz 2100, Palermo',
    date: '18 Ago 2026',
    description: 'Ramas de gran porte caídas tras tormenta, despejadas por cuadrilla de arbolado.',
  },
];
