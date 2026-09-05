/**
 * Spider Web Omega 2D Canvas Visualizer
 * Renders an interactive spider web node network based on multi-password inputs
 */
class SpiderWebCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nodes = [];
    this.centerNode = { x: 0, y: 0 };
    this.pulse = 0;
    this.particles = [];
    
    this.initCanvas();
    this.initParticles();
    this.animate();
  }

  initCanvas() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth || 300;
    this.canvas.height = parent.clientHeight || 270;
    this.centerNode = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    
    // Default 3 node positions around center
    this.updateNodePositions("AlphaPass", "BetaPass", "GammaPass");
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * 90,
        speed: 0.005 + Math.random() * 0.015,
        size: 1 + Math.random() * 2
      });
    }
  }

  hashToAngle(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 360) * (Math.PI / 180);
  }

  updateNodePositions(alphaPass, betaPass, gammaPass) {
    const maxRadius = Math.min(this.canvas.width, this.canvas.height) * 0.38;
    
    const angleA = this.hashToAngle(alphaPass || 'Alpha');
    const angleB = this.hashToAngle(betaPass || 'Beta');
    const angleC = this.hashToAngle(gammaPass || 'Gamma');

    this.nodes = [
      {
        name: 'Alpha Strand',
        x: this.centerNode.x + Math.cos(angleA) * (maxRadius * 0.8),
        y: this.centerNode.y + Math.sin(angleA) * (maxRadius * 0.8),
        color: '#00f3ff'
      },
      {
        name: 'Beta Strand',
        x: this.centerNode.x + Math.cos(angleB) * maxRadius,
        y: this.centerNode.y + Math.sin(angleB) * maxRadius,
        color: '#9d4edd'
      },
      {
        name: 'Gamma Strand',
        x: this.centerNode.x + Math.cos(angleC) * (maxRadius * 0.9),
        y: this.centerNode.y + Math.sin(angleC) * (maxRadius * 0.9),
        color: '#00ff66'
      }
    ];
  }

  drawWebRings() {
    const rings = 5;
    const maxRadius = Math.min(this.canvas.width, this.canvas.height) * 0.42;

    this.ctx.lineWidth = 1;

    for (let r = 1; r <= rings; r++) {
      const currentRadius = (maxRadius / rings) * r;
      this.ctx.beginPath();
      this.ctx.strokeStyle = `rgba(0, 243, 255, ${0.05 + (r / rings) * 0.12})`;
      
      // Draw polygonal web ring
      const numSides = 8;
      for (let i = 0; i < numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2;
        const x = this.centerNode.x + Math.cos(angle) * currentRadius;
        const y = this.centerNode.y + Math.sin(angle) * currentRadius;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    }
  }

  drawStrands() {
    // Draw lines connecting center hub to nodes
    this.nodes.forEach(node => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.moveTo(this.centerNode.x, this.centerNode.y);
      this.ctx.lineTo(node.x, node.y);
      this.ctx.stroke();
    });

    // Connect node to node forming outer web perimeter
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(157, 78, 221, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
    this.ctx.lineTo(this.nodes[1].x, this.nodes[1].y);
    this.ctx.lineTo(this.nodes[2].x, this.nodes[2].y);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  drawNodes() {
    // Draw Center Master Hub Node
    this.ctx.beginPath();
    this.ctx.arc(this.centerNode.x, this.centerNode.y, 10 + Math.sin(this.pulse) * 2, 0, Math.PI * 2);
    this.ctx.fillStyle = '#00f3ff';
    this.ctx.shadowColor = '#00f3ff';
    this.ctx.shadowBlur = 15;
    this.ctx.fill();

    // Draw Outer Strand Nodes
    this.nodes.forEach(node => {
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color;
      this.ctx.shadowColor = node.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();

      // Reset shadow
      this.ctx.shadowBlur = 0;
    });
  }

  animateParticles() {
    this.ctx.fillStyle = '#00f3ff';
    this.particles.forEach(p => {
      p.angle += p.speed;
      const x = this.centerNode.x + Math.cos(p.angle) * p.radius;
      const y = this.centerNode.y + Math.sin(p.angle) * p.radius;

      this.ctx.beginPath();
      this.ctx.arc(x, y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  animate() {
    this.pulse += 0.05;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawWebRings();
    this.drawStrands();
    this.animateParticles();
    this.drawNodes();

    requestAnimationFrame(() => this.animate());
  }
}

window.SpiderWebCanvas = SpiderWebCanvas;
