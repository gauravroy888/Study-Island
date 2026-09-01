const BOM = {
    'U1': {
        title: 'LM2596S-5.0 (IC)',
        desc: '150kHz 3A Step-Down Voltage Regulator',
        package: 'TO-263-5',
        purpose: 'The heart of the buck converter. Efficiently steps down 12V to 5V.'
    },
    'L1': {
        title: '33µH Power Inductor',
        desc: '>3.5A Saturation Current',
        package: 'SMD 10x10mm',
        purpose: 'Stores energy during the ON cycle and releases it during the OFF cycle to maintain output current.'
    },
    'D1': {
        title: '1N5822 (Schottky Diode)',
        desc: '3A, 40V Schottky Rectifier',
        package: 'SMC/DO-214AB',
        purpose: 'Provides a freewheeling path for the inductor current when the internal switch turns off.'
    },
    'Cin': {
        title: '680µF Input Capacitor',
        desc: '35V, Low ESR',
        package: 'Radial/SMD',
        purpose: 'Provides local low-impedance energy to prevent input voltage droop during switching.'
    },
    'Cout': {
        title: '220µF Output Capacitor',
        desc: '16V, Low ESR',
        package: 'Radial/SMD',
        purpose: 'Filters the output voltage ripple, providing a smooth 5V DC output.'
    }
};

const schematicSVG = document.getElementById('schematic-svg');
const layoutSVG = document.getElementById('layout-svg');
const bomDetails = document.getElementById('bom-details');

function setHoverInfo(ref) {
    const data = BOM[ref];
    if (data) {
        bomDetails.innerHTML = `
            <div class="bom-card">
                <h3>${ref}: ${data.title}</h3>
                <p><strong>Specs:</strong> ${data.desc}</p>
                <p><strong>Package:</strong> ${data.package}</p>
                <p><strong>Purpose:</strong> ${data.purpose}</p>
            </div>
        `;
    } else {
        bomDetails.innerHTML = `<p class="placeholder-text">Hover over a component to view its details.</p>`;
    }
}

// Helper to create SVG elements
function createSVGEl(type, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

// Draw Schematic
function drawSchematic() {
    // Nets
    const nets = [
        // Vin to IC Pin 1 and Cin
        { type: 'path', d: 'M 100 150 L 300 150 M 200 150 L 200 200', class: 'net net-vin' },
        // GND (bottom line)
        { type: 'path', d: 'M 100 350 L 700 350 M 200 350 L 200 250 M 350 350 L 350 280 M 500 350 L 500 250 M 600 350 L 600 250', class: 'net net-gnd' },
        // Switch Node (IC Pin 2 to L1 and D1)
        { type: 'path', d: 'M 400 150 L 500 150 M 500 150 L 500 200', class: 'net net-switch' },
        // Vout (L1 to Cout and Feedback and output)
        { type: 'path', d: 'M 550 150 L 700 150 M 600 150 L 600 200 M 650 150 L 650 280 L 320 280 L 320 220', class: 'net net-vout' }
    ];

    nets.forEach(n => schematicSVG.appendChild(createSVGEl(n.type, { d: n.d, class: n.class })));

    // Components (Groups)
    const components = [
        // IC
        { ref: 'U1', x: 300, y: 120, w: 100, h: 100, label: 'LM2596' },
        // Cin
        { ref: 'Cin', x: 180, y: 200, w: 40, h: 50, label: 'Cin' },
        // D1
        { ref: 'D1', x: 480, y: 200, w: 40, h: 50, label: 'D1' },
        // L1
        { ref: 'L1', x: 500, y: 130, w: 50, h: 40, label: 'L1' },
        // Cout
        { ref: 'Cout', x: 580, y: 200, w: 40, h: 50, label: 'Cout' }
    ];

    components.forEach(c => {
        const g = createSVGEl('g', { class: 'component', transform: `translate(${c.x}, ${c.y})` });
        g.appendChild(createSVGEl('rect', { width: c.w, height: c.h, rx: 5 }));
        g.appendChild(createSVGEl('text', { x: c.w/2, y: c.h/2 + 5, 'text-anchor': 'middle' }));
        g.lastChild.textContent = c.label;
        
        g.addEventListener('mouseenter', () => setHoverInfo(c.ref));
        g.addEventListener('mouseleave', () => setHoverInfo(''));
        
        schematicSVG.appendChild(g);
    });

    // Labels
    const labels = [
        { x: 100, y: 140, text: '+12V IN', fill: 'var(--net-vin)' },
        { x: 100, y: 340, text: 'GND', fill: 'var(--net-gnd)' },
        { x: 700, y: 140, text: '+5V OUT', fill: 'var(--net-vout)' },
        { x: 700, y: 340, text: 'GND', fill: 'var(--net-gnd)' }
    ];
    labels.forEach(l => {
        const text = createSVGEl('text', { x: l.x, y: l.y, fill: l.fill });
        text.textContent = l.text;
        schematicSVG.appendChild(text);
    });
}

// Draw Layout
function drawLayout() {
    // Board Outline
    layoutSVG.appendChild(createSVGEl('rect', { x: 200, y: 100, width: 400, height: 300, fill: '#1e293b', stroke: '#475569', 'stroke-width': 2, rx: 10 }));

    // High current loop pour highlight
    layoutSVG.appendChild(createSVGEl('path', { d: 'M 250 150 L 450 150 L 450 300 L 250 300 Z', fill: 'rgba(239, 68, 68, 0.1)', stroke: 'var(--net-vin)', 'stroke-dasharray': '5,5' }));
    
    const layoutText = createSVGEl('text', { x: 350, y: 130, fill: 'var(--net-vin)', 'text-anchor': 'middle', 'font-size': '12px' });
    layoutText.textContent = 'Keep this loop VERY tight!';
    layoutSVG.appendChild(layoutText);

    const components = [
        // IC
        { ref: 'U1', x: 350, y: 200, w: 80, h: 80, label: 'U1' },
        // Cin (Very close to U1 pin 1 & Tab)
        { ref: 'Cin', x: 270, y: 180, w: 60, h: 60, label: 'Cin' },
        // D1 (Close to U1 pin 2 & Tab)
        { ref: 'D1', x: 360, y: 300, w: 60, h: 40, label: 'D1' },
        // L1 (Next to D1)
        { ref: 'L1', x: 460, y: 210, w: 70, h: 70, label: 'L1' },
        // Cout (After L1)
        { ref: 'Cout', x: 550, y: 220, w: 60, h: 60, label: 'Cout' }
    ];

    components.forEach(c => {
        const g = createSVGEl('g', { class: 'component', transform: `translate(${c.x}, ${c.y})` });
        g.appendChild(createSVGEl('rect', { width: c.w, height: c.h, rx: 3 }));
        g.appendChild(createSVGEl('text', { x: c.w/2, y: c.h/2 + 5, 'text-anchor': 'middle' }));
        g.lastChild.textContent = c.label;
        
        g.addEventListener('mouseenter', () => setHoverInfo(c.ref));
        g.addEventListener('mouseleave', () => setHoverInfo(''));
        
        layoutSVG.appendChild(g);
    });
}

// Init
drawSchematic();
drawLayout();

// Tab switching
const btnSchematic = document.getElementById('btn-schematic');
const btnLayout = document.getElementById('btn-layout');

btnSchematic.addEventListener('click', () => {
    btnSchematic.classList.add('active');
    btnLayout.classList.remove('active');
    schematicSVG.classList.add('active');
    layoutSVG.classList.remove('active');
});

btnLayout.addEventListener('click', () => {
    btnLayout.classList.add('active');
    btnSchematic.classList.remove('active');
    layoutSVG.classList.add('active');
    schematicSVG.classList.remove('active');
});
