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

function decToHex (number) {
	var hexDigits = [];
	var quotient;
	var remainder;
	
	while (number > 0) {
		remainder = number % 16;
		switch (remainder) {
			case 10:
				remainder = 'a';
				break;
			case 11:
				remainder = 'b';
				break;
			case 12:
				remainder = 'c';
				break;
			case 13:
				remainder = 'd';
				break;
			case 14:
				remainder = 'e';
				break;
			case 15:
				remainder = 'f';
				break;
			default:
				// no change
				break;
		}
		hexDigits.push(remainder);
		quotient = Math.floor(number / 16);
		number = quotient;
	}
	
	hexDigits.reverse();
	return hexDigits.join("");
}

function hexToDec (string) {
	if (string.charAt(0) == '#') {
		string = string.substring(1);
	} else if (string.charAt(1) == 'x') {
		string = string.substring(2);
	}
	var decimal = 0;
	var value;
	var translatedValue;
	var power;
	var digit;
	for (var i = string.length - 1; i >= 0; i--) {
		value = string.charAt(i);
		translatedValue = parseInt(value, 16);
		power = string.length - i - 1;
		digit = translatedValue * Math.pow(16, power);
		decimal += digit;	
	}
	return decimal;
}

class Vertex {

	constructor (name, radius) {
		this.name = name;
		this.center = {x: 0, y: 0};
		this.acceleration = {x: 0, y: 0};
		this.velocity = {x: 0, y: 0};
		this.color = '#ffffff';
		this.textCenter = {x: 0, y: 0};
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
	
	calculate () {
		var canvas = this.canvas;
		var timeStep = 1; // 1 seems good
	
		var force = {x: 0, y: 0};
		var forceComponent = {x: 0, y: 0};
		var anchors = this.anchors;
		var numVertices = this.numVertices;
		var numEdges = this.numEdges;
	
		if (numVertices < 20 && numEdges / numVertices > 0.5){
			for (var a = 0; a < anchors.length; a++){
				a.mass = this.anchorMass;
			}
		}
	
		var unitVector = {x: 0, y: 0};
		var distanceSquared;
		var vertex;
		var opposingVertices;
		var opposingVertex;
		var vertices = this.vertices;
		var vertexRadius = this.vertexRadius;
	
		for (var i = 0; i < vertices.length; i++) {
			force.x = force.y = 0;
			vertex = vertices[i];
			if (vertex.mobile) {
		
				// first calculate force with adjacent vertices (repulsion)
		
				opposingVertices = vertex.adjacentVertices;
				for (var j = 0; j < opposingVertices.length; j++) {
					opposingVertex = opposingVertices[j];
			
					// vector away from opposingVertex towards vertex
					unitVector.x = vertex.center.x - opposingVertex.center.x;
					unitVector.y = vertex.center.y - opposingVertex.center.y;
			
					distanceSquared = Math.pow((vertex.center.x - opposingVertex.center.x), 2) + 
						Math.pow((vertex.center.y - opposingVertex.center.y), 2);
					if (distanceSquared == 0) { 
						distanceSquared = Math.pow(10, -3);
					}
					forceComponent.x = (this.repulsionFactor * vertex.mass * opposingVertex.mass * unitVector.x) / distanceSquared;
					forceComponent.y = (this.repulsionFactor * vertex.mass * opposingVertex.mass * unitVector.y) / distanceSquared;
					force.x += forceComponent.x;
					force.y += forceComponent.y;
				}
		
				// then calculate force with nonadjacent vertices
		
				opposingVertices = vertex.nonAdjacentVertices;
		
				for (var j = 0; j < opposingVertices.length; j++) {
					opposingVertex = opposingVertices[j];
		
					// vector away from vertex towards opposingVertex
					unitVector.x = opposingVertex.center.x - vertex.center.x;
					unitVector.y = opposingVertex.center.y - vertex.center.y;
			
					distanceSquared = Math.pow((vertex.center.x - opposingVertex.center.x), 2) + 
						Math.pow((vertex.center.y - opposingVertex.center.y), 2);
					if (distanceSquared <= 0.01) { 
						distanceSquared = 0.01;
					}
					forceComponent.x = (this.attractionFactor * vertex.mass * opposingVertex.mass * unitVector.x) / distanceSquared;
					forceComponent.y = (this.attractionFactor * vertex.mass * opposingVertex.mass * unitVector.y) / distanceSquared;
					force.x += forceComponent.x;
					force.y += forceComponent.y;
				}
		
				vertex.acceleration.x = force.x;
				vertex.acceleration.y = force.y;
			
				if (this.withWalls) {
					// for collision with wall
		
					if (
						vertex.center.x <= 1.25*vertexRadius ||
						vertex.center.y <= 1.25*vertexRadius ||
						vertex.center.x >= (canvas.width - 1.25*vertexRadius) ||
						vertex.center.y >= (canvas.height - 1.25*vertexRadius)
					) {
						vertex.velocity.x *= -1;
						vertex.velocity.y *= -1;
					}
				}
		
				// calculate new position
				vertex.center.x += (vertex.velocity.x * timeStep) + (0.5 * vertex.acceleration.x * Math.pow(timeStep, 2));
				vertex.center.y += (vertex.velocity.y * timeStep) + (0.5 * vertex.acceleration.y * Math.pow(timeStep, 2));
		
				// calculate new velocity
				vertex.velocity.x += vertex.acceleration.x * timeStep;
				vertex.velocity.y += vertex.acceleration.y * timeStep;
			
				// imaginary friction
				vertex.velocity.x /= Math.max(1, ((3000 + this.iteration) / 3000));
				vertex.velocity.y /= Math.max(1, ((3000 + this.iteration) / 3000));
			
				// collisions with other vertices
				if (this.collideWithVertices) {
					for (var k = 0; k < vertices.length; k++) {
						if (
							(vertex.center.x - vertices[k].center.x <= 2.1 * vertexRadius) && 
							(vertex.center.y - vertices[k].center.y <= 2.1 * vertexRadius)
						) {
							vertex.velocity.x *= -1;
							vertex.velocity.y *= -1;
						}
					}
				}
			
				// for collision with anchor
				if (this.collideWithAnchors) {
					for (var k = 0; k < anchors.length; k++) {
						if (
							vertex.center.x >= (anchors[k].center.x - (2 * vertexRadius)) &&
							vertex.center.x < (anchors[k].center.x + (2 * vertexRadius)) &&
							vertex.center.y >= (anchors[k].center.y - (2 * vertexRadius)) &&
							vertex.center.y < (anchors[k].center.y + (2 * vertexRadius))
						) {
							if (vertex.center.x < anchors[k].center.x) {
								vertex.center.x = anchors[k].center.x - (2 * vertexRadius);
							} else if (vertex.center.x >= anchors[k].center.x) {
								vertex.center.x = anchors[k].center.x + (2 * vertexRadius);
							} else if (vertex.center.y < anchors[k].center.y) {
								vertex.center.y = anchors[k].center.y - (2 * vertexRadius);
							} else if (vertex.center.y >= anchors[k].center.y) {
								vertex.center.y = anchors[k].center.y + (2 * vertexRadius);
							}
						}
					}
				}
			} // end if(vertex.mobile)
		} // end for loop
	}

	animate () {
	
		// calculate changes
	
		// clear the canvas
		var canvas = this.canvas;
		var context = this.context;
		var vertices = this.vertices;
		context.clearRect(0, 0, canvas.width, canvas.height);
	
		// draw edges if checked
		if (this.drawingEdges) {
			var edges = this.edges;
			for (var i = 0; i < edges.length; i++) {
				edges[i].render(context);
			}
		}

		// draw vertices
		for (var i = 0; i < vertices.length; i++) {
			vertices[i].render(context);
		}
	
		this.calculate();
		this.animationID = window.setTimeout(this.animate.bind(this), 40);
		this.iteration++;
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
		clearTimeout(this.animationID);
		this.pauseButton.value = "Unpause simulation";
	}
	
	queryRegion () {
		if (!this.querying) {
			if (!this.paused) {
				this.pauseButton.click();	
			}
	
			var regionX = this.regionXTextbox.value;
			var regionY = this.regionYTextbox.value;
			var regionRadius = this.regionRadiusTextbox.value;
			var canvas = this.canvas;
			var context = this.context;
	
			this.imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	
			context.save();
			context.strokeStyle = '#000';
			context.lineWidth = 1;
			context.beginPath();
			context.arc(regionX, regionY, regionRadius, 0, (2 * Math.PI), true);
			context.closePath();
			context.stroke();
			context.restore();
	
			this.querying = true;
			this.queryDiv.style.display = 'block';
			var queryRegionVertices = [];
			var setSize = 0;
			var resultString = "";
			var vertices = this.vertices;
			for (var v = 0; v < vertices.length; v++) {
				if (vertices[v].mobile) { // weeds out anchor vertices
					if (Math.pow(vertices[v].center.x - regionX, 2) + Math.pow(vertices[v].center.y - regionY, 2) < Math.pow(regionRadius, 2)) {
						queryRegionVertices[v] = vertices[v];
						setSize++;
						resultString += (vertices[v].toString() + "<br />");
					}
				}
			}
		
			var edgeFound = false;
			for (var w = 0; w < queryRegionVertices.length; w++) {
				if (queryRegionVertices[w] != null) {
					for (var x = 0; x < queryRegionVertices[w].adjacentVertices.length; x++) {
						if (queryRegionVertices[parseInt(queryRegionVertices[w].adjacentVertices[x].name.substring(2), 10)] != null) {
							edgeFound = true;
							break;
						}
					}
				}
			
				if (edgeFound) {
					break;
				}
			}
		
			if (edgeFound) {
				this.independenceDiv.innerHTML = "Uh, oh! It appears that this set is not independent.";
			} else {
				this.independenceDiv.innerHTML = "Success! An independent set of size " + setSize + "! <span style='font-size: 0.6em;'><a href='http://www.thewire.com/entertainment/2012/01/target-kristen-wiigs-target-lady-approved/47866/'>I gotta get me one o' those.</a></span>";
			}
						
			this.resultsDiv.innerHTML = resultString;
		}
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
	
	start () {
		if (this.querying) {
			this.queryDiv.style.display = 'none';
			this.querying = false;
		}

		this.simulating = true;

		this.numVertices = this.numVerticesTextbox.value;
		var numVertices = this.numVertices;
		this.numEdges = this.numEdgesTextbox.value;
		var numEdges = this.numEdges;

		this.vertices = [];
		var vertices = this.vertices;
		var vertexRadius = this.vertexRadius;
		this.anchors = [];
		var anchors = this.anchors;
		for (var i = 0; i < numVertices; i++) {
			vertices.push(new Vertex('V_' + i, vertexRadius));
		}

		var canvas = this.canvas;
		var center_x = canvas.width/2;
		var center_y = canvas.height/2;
		var radius = canvas.height/4;

		var vertexSubscript;
		var maxColor = parseInt('ffffff', 16);

		for (var i = 0; i < numVertices; i++) {
			vertices[i].center = {x: (Math.random() * canvas.width) + 1, y: (Math.random() * canvas.height) + 1};
			vertices[i].center.x = Math.max(20, Math.min((canvas.width - 20), vertices[i].center.x));
			vertices[i].center.y = Math.max(20, Math.min((canvas.height - 20), vertices[i].center.y));
			vertexSubscript = parseInt(vertices[i].name.substring(2), 10);
			vertices[i].color = 'hsl(' + (vertexSubscript * (360 / numVertices)) + ', 100%, 75%)';
		}
	
		this.withAnchor = this.withAnchorCheckbox.checked;
		this.withWalls = this.withWallsCheckbox.checked;
	
		if (this.manualOverrideCheckbox.checked) {
			this.attractionFactor = this.attractionFactorTextbox.value;
			this.repulsionFactor = this.repulsionFactorTextbox.value;
			this.anchorMass = this.anchorMassTextbox.value;
		} else {
			this.anchorMass = 4;
			this.attractionFactor = 1;
			this.repulsionFactor = 1.5 * numVertices * Math.max(1.5, Math.min(1.5, numVertices / numEdges));
			this.repulsionFactorTextbox.value = this.repulsionFactor;
			this.attractionFactorTextbox.value = this.attractionFactor;
			this.anchorMassTextbox.value = this.anchorMass;
		}
	
		if (this.withAnchor) {
			// create anchors

			vertices.push(new Vertex('x'));
			vertices[vertices.length - 1].center = {x: canvas.width / 2, y: canvas.height / 2};
			vertices[vertices.length - 1].mass = this.anchorMass;
			vertices[vertices.length - 1].mobile = false;
			vertices[vertices.length - 1].color = '#000';
			anchors.push(vertices[vertices.length - 1]);
		}

		this.edges = [];
		var edges = this.edges;
		var fromVertex, toVertex;

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
		for (var i = 0; i < edges.length; i++) {
			edges[i].to.adjacentVertices.push(edges[i].from);
			edges[i].from.adjacentVertices.push(edges[i].to);
		}

		// calculate nonEdges
		var allEdges = [];
		var nonEdges = [];
		for (var i = 0; i < vertices.length; i++) {
			var row = [];
			for (var j = 0; j < vertices.length; j++) {
				row.push(new Edge(vertices[i], vertices[j]));
			}
			allEdges.push(row);
		}

		var fromVertex;
		var toVertex;
		for (var i = 0; i < edges.length; i++) {
			fromVertex = parseInt(edges[i].from.name.substring(2));
			toVertex = parseInt(edges[i].to.name.substring(2));
			allEdges[fromVertex][toVertex] = null;
		}

		for (var i = 0; i < allEdges.length; i++) {
			for (var j = 0; j < allEdges[i].length; j++) {
				if (allEdges[i][j] != null) {
					nonEdges.push(new Edge(vertices[i], vertices[j]));
				}
			}
		}

		// add nonAdjacentVertices for each vertex
		for (var i = 0; i < nonEdges.length; i++) {
			nonEdges[i].to.nonAdjacentVertices.push(nonEdges[i].from);
			nonEdges[i].from.nonAdjacentVertices.push(nonEdges[i].to);
		}

		this.iteration = 0;
	
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

		this.animate();
		this.startButton.value = "End simulation";
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
}

$(window).on('load', function () {
	new IndependentSetPhysicsSimulation();
});