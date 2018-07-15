/**
 * Tests an algorithm for finding the maximal independent set.
 * Author: Chris Middleton
 * Originally written: 2014-01-19
 * TODOs:
 * - perhaps make it an inverse cube law instead, so that when they're far away, there's less effect
 * or just make it the factors smaller...
 * - try to get rid of the shaking... and occasionally wiggle the ones on the edge loose
 * - sort vertices and verify that they form an independent set (when queried)
 * - Find some upper bound for the largest independent set given the number of  vertices and edges
 * and make sure the repulsionFactor is large enough to counteract that.
**/

class Vec2 {
	constructor (x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}
	add (vec) {
		this.x += vec.x;
		this.y += vec.y;
	}
	distanceSquaredFrom (vec) {
		return Math.pow((this.x - vec.x), 2) + 
			Math.pow((this.y - vec.y), 2);
	}
	load (vec) {
		this.x = vec.x;
		this.y = vec.y;
	}
	minus (vec) {
		return new Vec2(this.x - vec.x, this.y - vec.y);
	}
	plus (vec) {
		return new Vec2(this.x + vec.x, this.y + vec.y);
	}
	times (c) {
		return new Vec2(this.x * c, this.y * c);
	}
}

Vec2.copyFrom = function (vec, otherVec) {
	vec.x = otherVec.x;
	vec.y = otherVec.y;
};

class Vertex {

	constructor (name, radius) {
		this.name = name;
		this.center = new Vec2();
		this.acceleration = new Vec2();
		this.velocity = new Vec2();
		this.color = '#ffffff';
		this.textCenter = new Vec2();
		this.adjacentVertices = [];
		this.nonAdjacentVertices = [];
		this.mobile = true;
		this.mass = 1;
		this.radius = radius;
	}
	
	render (context) {
		context.save();
		
		context.beginPath();
		context.arc(this.center.x, this.center.y, this.radius, 0, 2 * Math.PI, true);
		context.closePath();
		context.lineWidth = 1;
		context.strokeStyle = 'black';
		context.fillStyle = this.color;
		context.stroke();
		context.fill();
		
		context.fillStyle = 'black';
		context.font = "8pt Helvetica";
		if (this.name.length == 3) { // one digit number
			context.fillText(this.name.substring(2), this.center.x - (this.radius / 4), this.center.y + (this.radius / 4));
		} else if (this.name.length == 4) { // two digit number
			context.fillText(this.name.substring(2), this.center.x - (this.radius / 1.75), this.center.y + (this.radius / 4));
		} else { // three digit number
			context.fillText(this.name.substring(2), this.center.x - (this.radius / 1.15), this.center.y + (this.radius / 3.5));
		}
		
		context.restore();
	}
	
	toString () {
		return this.name;
	}

}

class Edge {

	constructor (from, to) {
		this.from = from;
		this.to = to;
	}
	render (context) {
		context.save();
		context.beginPath();
		context.moveTo(this.from.center.x, this.from.center.y);
		context.lineTo(this.to.center.x, this.to.center.y);
		context.strokeStyle = '#000';
		context.stroke();
		context.restore();
	}
	
	toString () {
		return '{from: ' + this.from.toString() + ', to: ' + this.to.toString() + '}';		
	}
	
}

class IndependentSetPhysicsSimulation {

	constructor () {
		this.canvas = document.getElementById('isp-canvas');
		this.context = this.canvas.getContext('2d');
		this.vertices = [];
		this.edges = [];
		this.animationID = null;
		this.vertexRadius = 10;
		this.paused = false;
		this.iteration = 0;
		this.anchors = [];
		this.numVertices = 0;
		this.numEdges = 0;
		this.numVerticesTextbox = document.getElementById('isp-num-vertices-field');
		this.numEdgesTextbox = document.getElementById('isp-num-edges-field');
		this.startButton = document.getElementById('isp-start-simulation-button');
		this.pauseButton = document.getElementById('isp-pause-simulation-button');
		this.simulating = false;
		this.queryRegionButton = document.getElementById('isp-query-region-button');
		this.regionXTextbox = document.getElementById('isp-query-region-x-field');;
		this.regionYTextbox = document.getElementById('isp-query-region-y-field');
		this.regionRadiusTextbox = document.getElementById('isp-query-region-radius-field');
		this.imageData = null;
		this.withAnchorCheckbox = document.getElementById('isp-anchors-toggle');
		this.withWallsCheckbox = document.getElementById('isp-walls-toggle');
		this.withAnchor = false;
		this.withWalls = false;
		this.querying = false;
		this.queryDiv = document.getElementById('isp-query-popup');
		this.resultsDiv = document.getElementById('isp-results-box');
		this.independenceDiv = document.getElementById('isp-independence-box');
		this.repulsionFactorTextbox = document.getElementById('isp-repulsion-factor-field');
		this.attractionFactorTextbox = document.getElementById('isp-attraction-factor-field');
		this.anchorMassTextbox = document.getElementById('isp-anchor-mass-field');
		this.attractionFactor = 0;
		this.repulsionFactor = 0;
		this.drawEdgesCheckbox = document.getElementById('isp-draw-edges-toggle');
		this.drawingEdges = false;
		this.manualOverrideCheckbox = document.getElementById('isp-manual-override-toggle');
		this.anchorMass = 0;
		this.collideWithVertices = false;
		this.collideWithAnchors = false;
		
		$(this.startButton).on('click', this.onStartButtonClick.bind(this));
		$(this.pauseButton).on('click', this.onPauseButtonClick.bind(this));
		$(this.queryRegionButton).on('click', this.queryRegion.bind(this));
		$(this.drawEdgesCheckbox).on('change', this.toggleEdges.bind(this));
	}
	
	animate () {
		this.render();
		this.calculate();
		this.animationID = window.setTimeout(this.animate.bind(this), 40);
		this.iteration++;
	}
	
	applyFriction (vertex, iteration) {
		// imaginary friction
		vertex.velocity.x /= Math.max(1, ((3000 + iteration) / 3000));
		vertex.velocity.y /= Math.max(1, ((3000 + iteration) / 3000));
	}
	
	calculate () {
		 // 1 seems good
		var timeStep = 1;
		for (var vertex of this.vertices) {
			this.updateVertex(vertex, timeStep);
		}
	}
	
	computeAllEdges (vertices, edges) {
		var allEdges = [];
		for (var vertex1 of vertices) {
			var row = [];
			for (var vertex2 of vertices) {
				row.push(new Edge(vertex1, vertex2));
			}
			allEdges.push(row);
		}

		var fromVertex;
		var toVertex;
		for (var edge of edges) {
			fromVertex = parseInt(edge.from.name.substring(2));
			toVertex = parseInt(edge.to.name.substring(2));
			allEdges[fromVertex][toVertex] = null;
		}
		return allEdges;
	}
	
	computeAttraction (vertex) {
		var attraction = new Vec2();
		for (var opposingVertex of vertex.nonAdjacentVertices) {
			// vector away from vertex towards opposingVertex
			var unitVector = opposingVertex.center.minus(vertex.center);
			var distanceSquared = vertex.center.distanceSquaredFrom(opposingVertex.center);
			if (distanceSquared <= 0.01) { 
				distanceSquared = 0.01;
			}
			attraction.add(unitVector.times((this.attractionFactor * vertex.mass * opposingVertex.mass) / distanceSquared));
		}
		return attraction;
	}
	
	computeNonAdjacentVertices (vertices, edges) {
		var nonEdges = this.computeNonEdges(vertices, edges);
		// add nonAdjacentVertices for each vertex
		for (var edge of nonEdges) {
			edge.to.nonAdjacentVertices.push(edge.from);
			edge.from.nonAdjacentVertices.push(edge.to);
		}
	}
	
	computeNonEdges (vertices, edges) {
		var allEdges = this.computeAllEdges(vertices, edges);
		var nonEdges = [];
		for (var [i, row] of allEdges.entries()) {
			for (var [j, edge] of row.entries()) {
				// TODO: needs comment or change
				if (allEdges[i][j] != null) {
					nonEdges.push(new Edge(vertices[i], vertices[j]));
				}
			}
		}
		return nonEdges;
	}
	
	computeQueryRegionVertices (vertices, regionX, regionY, regionRadius) {
		var queryRegionVertices = {};
		for (var v = 0; v < vertices.length; v++) {
			if (vertices[v].mobile) { // weeds out anchor vertices
				if (Math.pow(vertices[v].center.x - regionX, 2) + Math.pow(vertices[v].center.y - regionY, 2) < Math.pow(regionRadius, 2)) {
					queryRegionVertices[v] = vertices[v];
				}
			}
		}
		return queryRegionVertices;
	}
	
	computeRepulsion (vertex) {
		var repulsion = new Vec2();
		for (var opposingVertex of vertex.adjacentVertices) {
			// vector away from opposingVertex towards vertex
			var unitVector = vertex.center.minus(opposingVertex.center);
			var distanceSquared = vertex.center.distanceSquaredFrom(opposingVertex.center);
			if (distanceSquared == 0) { 
				distanceSquared = Math.pow(10, -3);
			}
			repulsion.add(unitVector.times((this.repulsionFactor * vertex.mass * opposingVertex.mass) / distanceSquared));
		}
		return repulsion;
	}
	
	generateAnchors (canvas, anchorMass) {
		var anchor = new Vertex('x');
		anchor.center = new Vec2(canvas.width / 2, canvas.height / 2);
		anchor.mass = anchorMass;
		anchor.mobile = false;
		anchor.color = '#000';
		return [anchor];
	}
	
	generateEdges (vertices, numEdges) {
		var edges = [];
		var fromVertex, toVertex;
		var numVertices = vertices.length;
		for (var i = 0; i < numEdges; i++) {
			fromVertex = Math.floor(numVertices * Math.random());
			toVertex = Math.floor(numVertices * Math.random());

			if (fromVertex < toVertex) {
				edges.push(new Edge(vertices[fromVertex], vertices[toVertex]));
			} else {
				i--;
			}
		}

		// add edges to the vertices
		for (var edge of edges) {
			edge.to.adjacentVertices.push(edge.from);
			edge.from.adjacentVertices.push(edge.to);
		}
		return edges;
	}
	
	generateVertices (numVertices, vertexRadius, canvas) {
		var vertices = [];
		for (var i = 0; i < numVertices; i++) {
			var vertex = new Vertex('V_' + i, vertexRadius)
			vertex.center = new Vec2((Math.random() * canvas.width) + 1, (Math.random() * canvas.height) + 1);
			vertex.center.x = Math.max(20, Math.min((canvas.width - 20), vertex.center.x));
			vertex.center.y = Math.max(20, Math.min((canvas.height - 20), vertex.center.y));
			var vertexSubscript = parseInt(vertex.name.substring(2), 10);
			vertex.color = 'hsl(' + (vertexSubscript * (360 / numVertices)) + ', 100%, 75%)';
			vertices.push(vertex);
		}
		return vertices;
	}
	
	handleCollisionsWithAnchor (vertex, anchors, vertexRadius) {
		for (var anchor of anchors) {
			if (this.isCollidingWithAnchor(vertex, anchor, vertexRadius)) {
				if (vertex.center.x < anchor.center.x) {
					vertex.center.x = anchor.center.x - (2 * vertexRadius);
				} else if (vertex.center.x >= anchor.center.x) {
					vertex.center.x = anchor.center.x + (2 * vertexRadius);
				} else if (vertex.center.y < anchor.center.y) {
					vertex.center.y = anchor.center.y - (2 * vertexRadius);
				} else if (vertex.center.y >= anchor.center.y) {
					vertex.center.y = anchor.center.y + (2 * vertexRadius);
				}
			}
		}
	}
	
	handleCollisionsWithVertices (vertex, vertices, vertexRadius) {
		for (var otherVertex of vertices) {
			if (this.isCollidingWithVertex(vertex, otherVertex, vertexRadius)) {
				vertex.velocity.x *= -1;
				vertex.velocity.y *= -1;
			}
		}
	}
	
	handleCollisionsWithWalls (vertex, canvas, vertexRadius) {
		// for collision with wall
		if (this.isCollidingWithWall(vertex, canvas, vertexRadius)) {
			vertex.velocity.x *= -1;
			vertex.velocity.y *= -1;
		}
	}
	
	initGraph () {
		this.vertices = this.generateVertices(this.numVertices, this.vertexRadius, this.canvas);
		if (this.withAnchor) {
			this.anchors = this.generateAnchors(this.canvas, this.anchorMass);
		} else {
			this.anchors = [];
		}
		for (var anchor of this.anchors) {
			this.vertices.push(anchor);
		}
		this.edges = this.generateEdges(this.vertices, this.numEdges);
		this.computeNonAdjacentVertices(this.vertices, this.edges);
	}
	
	initParameters () {
		this.numVertices = this.numVerticesTextbox.value;
		this.numEdges = this.numEdgesTextbox.value;		
		this.withAnchor = this.withAnchorCheckbox.checked;
		this.withWalls = this.withWallsCheckbox.checked;
	
		if (this.manualOverrideCheckbox.checked) {
			this.attractionFactor = this.attractionFactorTextbox.value;
			this.repulsionFactor = this.repulsionFactorTextbox.value;
			this.anchorMass = this.anchorMassTextbox.value;
		} else {
			this.anchorMass = 4;
			this.attractionFactor = 1;
			this.repulsionFactor = 1.5 * this.numVertices * Math.max(1.5, Math.min(1.5, this.numVertices / this.numEdges));
			this.repulsionFactorTextbox.value = this.repulsionFactor;
			this.attractionFactorTextbox.value = this.attractionFactor;
			this.anchorMassTextbox.value = this.anchorMass;
		}
		if (this.numEdges < 1000) {
			this.drawingEdges = this.drawEdgesCheckbox.checked;
		} else if (this.drawEdgesCheckbox.checked) {
			var message = "Drawing more than 1000 edges is a bad idea unless you have a very fast computer.";
			message += "\nIf you choose not to draw the edges, they will still be factored into the computation.";
			message += "\nTo disable edge drawing, click cancel. To draw edges anyway, click OK.";
			if (confirm(message)) {
				this.drawingEdges = true;
			} else {
				this.drawingEdges = false;
				this.drawEdgesCheckbox.checked = false;
			}
		}
	}
	
	isCollidingWithAnchor (vertex, anchor, vertexRadius) {
		return (
			vertex.center.x >= (anchor.center.x - (2 * vertexRadius)) &&
			vertex.center.x < (anchor.center.x + (2 * vertexRadius)) &&
			vertex.center.y >= (anchor.center.y - (2 * vertexRadius)) &&
			vertex.center.y < (anchor.center.y + (2 * vertexRadius))
		);
	}
	
	isCollidingWithWall (vertex, canvas, vertexRadius) {
		return (
			vertex.center.x <= 1.25 * vertexRadius ||
			vertex.center.y <= 1.25 * vertexRadius ||
			vertex.center.x >= (canvas.width - 1.25 * vertexRadius) ||
			vertex.center.y >= (canvas.height - 1.25 * vertexRadius)
		);
	}
	
	isCollidingWithVertex (vertex, otherVertex, vertexRadius) {
		return (
			(vertex.center.x - otherVertex.center.x <= 2.1 * vertexRadius) && 
			(vertex.center.y - otherVertex.center.y <= 2.1 * vertexRadius)
		);
	}

	isIndependentSet (vertices) {
		var edgeFound = false;
		for (var w in vertices) {
			if (!vertices.hasOwnProperty(w)) continue;
			for (var x = 0; x < vertices[w].adjacentVertices.length; x++) {
				if (vertices[parseInt(vertices[w].adjacentVertices[x].name.substring(2), 10)] != null) {
					edgeFound = true;
					break;
				}
			}
			if (edgeFound) break;
		}
	}
	
	onStartButtonClick () {
		if (!this.simulating) {
			this.start();
		} else {
			this.stop();
		}
	}
	
	onPauseButtonClick () {
		if (!this.simulating) return;
		if (!this.paused) {
			this.pause();
		} else {
			this.resume();
		}
	}
	
	pause () {
		this.paused = true;
		if (this.animationID) {
			clearTimeout(this.animationID);
			this.animationID = null;
		}
		this.pauseButton.value = "Unpause simulation";
	}
	
	queryRegion () {
		if (this.querying) return;
		
		this.pause();
		
		this.querying = true;
		this.queryDiv.style.display = 'block';

		var regionX = this.regionXTextbox.value;
		var regionY = this.regionYTextbox.value;
		var regionRadius = this.regionRadiusTextbox.value;
		var canvas = this.canvas;
		var context = this.context;
		var vertices = this.vertices;

		this.renderQueryRegionBoundary(context, regionX, regionY, regionRadius);
		var queryRegionVertices = this.computeQueryRegionVertices(vertices, regionX, regionY, regionRadius);
		this.showIndependence(queryRegionVertices);
		this.showResults(queryRegionVertices);
	}
	
	render () {
		// clear the canvas
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		// draw edges if checked
		if (this.drawingEdges) this.renderObjects(this.context, this.edges);
		this.renderObjects(this.context, this.vertices);
	}
	
	renderObjects (context, objects) {
		for (var object of objects) {
			object.render(context);
		}
	}
	
	renderQueryRegionBoundary (context, regionX, regionY, regionRadius) {
		this.imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		context.save();
		context.strokeStyle = '#000';
		context.lineWidth = 1;
		context.beginPath();
		context.arc(regionX, regionY, regionRadius, 0, (2 * Math.PI), true);
		context.closePath();
		context.stroke();
		context.restore();
	}
		
	resume () {
		if (this.querying) {
			this.querying = false;
			this.queryDiv.style.display = 'none';
			this.context.putImageData(this.imageData, 0, 0);
		}

		this.animationID = window.setTimeout(this.animate.bind(this), 40);
		this.paused = false;
		this.pauseButton.value = "Pause simulation";
	}
	
	showIndependence (queryRegionVertices) {
		var queryRegionVerticesValues = Object.values(queryRegionVertices);
		var setSize = queryRegionVerticesValues.length;
		if (this.isIndependentSet(queryRegionVertices)) {
			this.independenceDiv.innerHTML = "Success! An independent set of size " + setSize + "! <span style='font-size: 0.6em;'><a href='http://www.thewire.com/entertainment/2012/01/target-kristen-wiigs-target-lady-approved/47866/'>I gotta get me one o' those.</a></span>";
		} else {
			this.independenceDiv.innerHTML = "Uh, oh! It appears that this set is not independent.";
		}
	}
	
	showResults (queryRegionVertices) {
		var queryRegionVerticesValues = Object.values(queryRegionVertices);
		var resultString = queryRegionVerticesValues.join("<br>");
		this.resultsDiv.innerHTML = resultString;
	}
	
	start () {
		this.initParameters();
		this.simulating = true;
		this.iteration = 0;
		this.initGraph();
		this.animate();
		this.updateUI();
	}
	
	stop () {
		this.simulating = false;
		this.startButton.value = "Start simulation";
		clearTimeout(this.animationID);
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	
		if (this.querying) {
			this.querying = false;
			this.queryDiv.style.display = 'none';
		}
	
		if (this.paused) {
			this.paused = false;
			this.pauseButton.value = "Pause simulation";
		}
	}
	
	toggleEdges () {
		var numEdges = this.numEdges;
		if (this.simulating) {
			if (numEdges < 1000) {
				this.drawingEdges = this.drawEdgesCheckbox.checked;
			} else if (this.drawEdgesCheckbox.checked) {
				var message = "Drawing more than 1000 edges is a bad idea unless you have a very fast computer.";
				message += "\nIf you choose not to draw the edges, they will still be factored into the computation.";
				message += "\nTo disable edge drawing, click cancel. To draw edges anyway, click OK.";
				if (confirm(message)) {
					this.drawingEdges = true;
				} else {
					this.drawingEdges = false;
					this.drawEdgesCheckbox.checked = false;
				}
			}
		}
	}
	
	updateAcceleration (vertex, attractionFactor, repulsionFactor) {
		// compute force from nonadjacent vertices (attraction)
		var attraction = this.computeAttraction(vertex, attractionFactor);
		// compute force from adjacent vertices (repulsion)
		var repulsion = this.computeRepulsion(vertex, repulsionFactor);
		vertex.acceleration.load(repulsion.plus(attraction));
	}
	
	updatePosition (vertex, timeStep) {
		vertex.center.x += (vertex.velocity.x * timeStep) + (0.5 * vertex.acceleration.x * Math.pow(timeStep, 2));
		vertex.center.y += (vertex.velocity.y * timeStep) + (0.5 * vertex.acceleration.y * Math.pow(timeStep, 2));
	}
	
	updateUI () {
		if (this.simulating) {
			if (this.querying) {
				this.queryDiv.style.display = 'none';
				this.querying = false;
			}
			this.startButton.value = "End simulation";
		}
	}
	
	updateVelocity (vertex, timeStep) {
		vertex.velocity.x += vertex.acceleration.x * timeStep;
		vertex.velocity.y += vertex.acceleration.y * timeStep;
	}
	
	updateVertex (vertex, timeStep) {
		if (!vertex.mobile) return;
		
		this.updateAcceleration(vertex, this.attractionFactor, this.repulsionFactor);
	
		if (this.withWalls) {
			this.handleCollisionsWithWalls(vertex, this.canvas, this.vertexRadius);
		}

		this.updatePosition(vertex, timeStep);
		this.updateVelocity(vertex, timeStep);
	
		this.applyFriction(vertex, this.iteration);
	
		if (this.collideWithVertices) {
			this.handleCollisionsWithVertices(vertex, vertices, this.vertexRadius);
		}
	
		if (this.collideWithAnchors) {
			this.handleCollisionsWithAnchor(vertex, anchors, this.vertexRadius);
		}
	}
	
}

$(window).on('load', function () {
	new IndependentSetPhysicsSimulation();
});