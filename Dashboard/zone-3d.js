/* ===============================
   TIER 3 COMMAND CENTER ENGINE
================================ */
const params = new URLSearchParams(window.location.search);
const ZONE = params.get("zone") || "A";
const PPM = Number(params.get("ppm")) || 0;

document.getElementById("zone-title").innerText = `ZONE ${ZONE} - INDUSTRIAL SECTION`;
document.getElementById("hud-ppm").innerHTML = `${PPM} <span class="unit">PPM</span>`;

if(PPM > 400) {
    document.getElementById("alert-panel").style.display = "block";
    document.getElementById("hud-ppm").classList.add("alert");
}

/* THREE.JS CORE */
const canvas = document.getElementById("zone3d");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000205);
scene.fog = new THREE.FogExp2(0x000205, 0.03);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(20, 15, 25);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* 1. HOLOGRAPHIC GROUND GRID */
const grid = new THREE.GridHelper(100, 50, 0x00d4ff, 0x051a2a);
grid.material.opacity = 0.15;
grid.material.transparent = true;
scene.add(grid);

/* 2. PROCEDURAL INDUSTRIAL INFRASTRUCTURE */
// We create a "Plant" look with wireframes
function createHologramMachine(w, h, d, x, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const wire = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.3 });
    const machine = new THREE.LineSegments(wire, mat);
    machine.position.set(x, h/2, z);
    scene.add(machine);

    // Add solid semi-transparent core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x001a2a, transparent: true, opacity: 0.4 });
    const core = new THREE.Mesh(geo, coreMat);
    core.position.copy(machine.position);
    scene.add(core);
}

// Layout a fake factory floor
createHologramMachine(8, 4, 8, -10, -10); // Processor
createHologramMachine(4, 10, 4, 15, -5);   // Storage Tank
createHologramMachine(6, 2, 12, 0, 15);    // Conveyor unit

/* 3. THE PIPELINE NETWORK (Animated Flow) */
const pipeGroup = new THREE.Group();
const pipeMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 });

function createPipe(x1, y1, z1, x2, y2, z2) {
    const points = [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, pipeMat);
    pipeGroup.add(line);
}

// Create a complex pipe grid
for(let i=0; i<5; i++) {
    createPipe(-20, 1.5, i*5, 20, 1.5, i*5); // Main lines
    createPipe(i*5, 1.5, -20, i*5, 1.5, 20); // Cross lines
}
scene.add(pipeGroup);

/* 4. VOLUMETRIC GAS LEAK (High Density Particles) */
let particles;
const particleCount = PPM < 80 ? 0 : Math.min(PPM * 4, 3000);
const velocityArray = [];

if (PPM > 50) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        pos[i*3] = 0; pos[i*3+1] = 1.5; pos[i*3+2] = 0; // Source at Valve (0, 1.5, 0)
        velocityArray.push((Math.random()-0.5)*0.1, Math.random()*0.15, (Math.random()-0.5)*0.1);
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.3,
        color: PPM > 400 ? 0xff4757 : 0x4ade80,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

/* 5. DYNAMIC LIGHTING */
const light = new THREE.PointLight(PPM > 400 ? 0xff4757 : 0x00d4ff, 10, 50);
light.position.set(0, 5, 0);
scene.add(light);

/* ANIMATION LOOP */
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Particle Logic
    if (particles) {
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i*3] += velocityArray[i*3];
            let verticalBias = 0;

switch (ZONE_DATA[ZONE].gas) {
    case "CH4": verticalBias = +0.25; break; // Methane rises
    case "LPG": verticalBias = -0.18; break; // LPG sinks
    case "H2S": verticalBias = -0.22; break; // Very heavy
    case "CO":  verticalBias = +0.05; break; // Diffuse
}

positions[i*3+1] += (velocityArray[i*3+1] + verticalBias);

            positions[i*3+2] += velocityArray[i*3+2];

            // Reset particles
            if (positions[i*3+1] > 15) {
                positions[i*3] = 0; positions[i*3+1] = 1.5; positions[i*3+2] = 0;
            }

            if (PPM > 350 && positions[i*3+1] > 3) {
    positions[i*3] = 0;
    positions[i*3+1] = 1.5;
    positions[i*3+2] = 0;
}

        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    // Light Pulse
    light.intensity = 5 + Math.sin(Date.now() * 0.005) * 5;

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});