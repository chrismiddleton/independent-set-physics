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

// getting i_2

var canvas;
var context;
var vertices;
var edges;
var animationID;
var vertexRadius;
var paused;
var iteration;
var anchors;
var numVertices;
var numEdges;
var numVerticesTextbox;
var numEdgesTextbox;
var startSimulationButton;
var pauseSimulationButton;
var simulating;
var queryRegionButton;
var regionXTextbox;
var regionYTextbox;
var regionRadiusTextbox;
var imageData;
var withAnchorCheckbox;
var withWallsCheckbox
var withAnchor;
var withWalls;
var querying;
var queryDiv;
var resultsDiv;
var independenceDiv;
var repulsionFactorTextbox;
var attractionFactorTextbox;
var anchorMassTextbox;
var attractionFactor;
var repulsionFactor;
var drawEdgesCheckbox;
var drawingEdges;
var manualOverrideCheckbox;
var anchorMass;

class Vertex {

	constructor (name) {
		this.name = name;
		this.center = {x: 0, y: 0};
		this.acceleration = {x: 0, y: 0};
		this.velocity = {x: 0, y: 0};
		this.color = '#ffffff';
		this.textCenter = {x: 0, y: 0};
		this.adjacentVertices = new Array();
		this.nonAdjacentVertices = new Array();
		this.mobile = true;
		this.mass = 1;
	}
	
	render () {
		context.save();
		
		context.beginPath();
		context.arc(this.center.x, this.center.y, vertexRadius, 0, 2*Math.PI, true);
		context.closePath();
		context.lineWidth = 1;
		context.strokeStyle = 'black';
		context.fillStyle = this.color;
		context.stroke();
		context.fill();
		
		context.fillStyle = 'black';
		context.font = "8pt Helvetica";
		if(this.name.length == 3){ // one digit number
			context.fillText(this.name.substring(2), this.center.x - (vertexRadius/4), this.center.y + (vertexRadius/4));
		} else if(this.name.length == 4){ // two digit number
			context.fillText(this.name.substring(2), this.center.x - (vertexRadius/1.75), this.center.y + (vertexRadius/4));
		} else{ // three digit number
			context.fillText(this.name.substring(2), this.center.x - (vertexRadius/1.15), this.center.y + (vertexRadius/3.5));
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
	render () {
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

function init(){

	canvas = document.getElementById('isp-canvas');
	context = canvas.getContext('2d');
	
	numVerticesTextbox = document.getElementById('isp-num-vertices-field');
	numEdgesTextbox = document.getElementById('isp-num-edges-field');
	startSimulationButton = document.getElementById('isp-start-simulation-button');
	pauseSimulationButton = document.getElementById('isp-pause-simulation-button');
	queryRegionButton = document.getElementById('isp-query-region-button');
	regionXTextbox = document.getElementById('isp-query-region-x-field');
	regionYTextbox = document.getElementById('isp-query-region-y-field');
	regionRadiusTextbox = document.getElementById('isp-query-region-radius-field');
	withWallsCheckbox = document.getElementById('isp-walls-toggle');
	withAnchorCheckbox = document.getElementById('isp-anchors-toggle');
	queryDiv = document.getElementById('isp-query-popup');
	resultsDiv = document.getElementById('isp-results-box');
	independenceDiv = document.getElementById('isp-independence-box');
	attractionFactorTextbox = document.getElementById('isp-attraction-factor-field');
	repulsionFactorTextbox = document.getElementById('isp-repulsion-factor-field');
	anchorMassTextbox = document.getElementById('isp-anchor-mass-field');
	drawEdgesCheckbox = document.getElementById('isp-draw-edges-toggle');
	manualOverrideCheckbox = document.getElementById('isp-manual-override-toggle');
	
	$(startSimulationButton).on('click', function(){
		if(!simulating){
		
			if(querying){
			
				queryDiv.style.display = 'none';
				querying = false;
				
			}
	
			simulating = true;
	
			numVertices = numVerticesTextbox.value;
			numEdges = numEdgesTextbox.value;
	
			vertices = new Array();
			anchors = new Array();
			for(var i = 0; i < numVertices; i++){
	
				vertices.push(new Vertex('V_' + i));
		
			}

			vertexRadius = 10;
	
			var center_x = canvas.width/2;
			var center_y = canvas.height/2;
			var radius = canvas.height/4;
	
			var vertexSubscript;
			var maxColor = parseInt('ffffff', 16);
	
			for(var i = 0; i < numVertices; i++){
				vertices[i].center = {x: (Math.random()*canvas.width) + 1, y: (Math.random()*canvas.height) + 1};
				vertices[i].center.x = Math.max(20, Math.min((canvas.width - 20), vertices[i].center.x));
				vertices[i].center.y = Math.max(20, Math.min((canvas.height - 20), vertices[i].center.y));
				vertexSubscript = parseInt(vertices[i].name.substring(2), 10);
				vertices[i].color = 'hsl(' + (vertexSubscript * 360/numVertices) + ', 100%, 75%)';
			}
			
			withAnchor = withAnchorCheckbox.checked;
			withWalls = withWallsCheckbox.checked;
			
			if(manualOverrideCheckbox.checked){
			
				attractionFactor = attractionFactorTextbox.value;
				repulsionFactor = repulsionFactorTextbox.value;
				anchorMass = anchorMassTextbox.value;
				
			} else{
			
				anchorMass = 4;
				attractionFactor = 1;
				repulsionFactor = 1.5*numVertices*Math.max(1.5, Math.min(1.5, numVertices/numEdges));
				repulsionFactorTextbox.value = repulsionFactor;
				attractionFactorTextbox.value = attractionFactor;
				anchorMassTextbox.value = anchorMass;
				
			}
			
			if(withAnchor){
	
			// create anchors
	
				vertices.push(new Vertex('x'));
				vertices[vertices.length - 1].center = {x: canvas.width/2, y: canvas.height/2};
				vertices[vertices.length - 1].mass = anchorMass;
				vertices[vertices.length - 1].mobile = false;
				vertices[vertices.length - 1].color = '#000';
				anchors.push(vertices[vertices.length - 1]);
				
			}
	
			edges = new Array();
		
			var fromVertex, toVertex;
	
			for(var i = 0; i < numEdges; i++){
	
				fromVertex = Math.floor(numVertices * Math.random());
				toVertex = Math.floor(numVertices * Math.random());
		
				if(fromVertex < toVertex){
		
					edges.push(new Edge(vertices[fromVertex], vertices[toVertex]));
			
				} else{
		
					i--;
			
				}
		
			}
		
			// add edges to the vertices
	
			for(var i = 0; i < edges.length; i++){
		
				edges[i].to.adjacentVertices.push(edges[i].from);
				edges[i].from.adjacentVertices.push(edges[i].to);
		
			}
	
			// calculate nonEdges
	
			var allEdges = new Array();
	
			var nonEdges = new Array();
	
			for(var i = 0; i < vertices.length; i++){
	
				var row = new Array();
	
				for(var j = 0; j < vertices.length; j++){
		
					row.push(new Edge(vertices[i], vertices[j]));
			
				}
		
				allEdges.push(row);
		
			}
	
			var fromVertex;
			var toVertex;
	
			for(var i = 0; i < edges.length; i++){
	
				fromVertex = parseInt(edges[i].from.name.substring(2));
				toVertex = parseInt(edges[i].to.name.substring(2));
	
				allEdges[fromVertex][toVertex] = null;
		
			}
	
			for(var i = 0; i < allEdges.length; i++){
	
				for(var j = 0; j < allEdges[i].length; j++){
		
					if(allEdges[i][j] != null){
			
						nonEdges.push(new Edge(vertices[i], vertices[j]));
				
					}
			
				}
		
			}
	
			// add nonAdjacentVertices for each vertex
	
			for(var i = 0; i < nonEdges.length; i++){
	
				nonEdges[i].to.nonAdjacentVertices.push(nonEdges[i].from);
				nonEdges[i].from.nonAdjacentVertices.push(nonEdges[i].to);
		
			}
	
			iteration = 0;
			
			if(numEdges < 1000){
	
				drawingEdges = drawEdgesCheckbox.checked;
		
			} else if(drawEdgesCheckbox.checked){
	
				var message = "Drawing more than 1000 edges is a bad idea unless you have a very fast computer.";
				message += "\nIf you choose not to draw the edges, they will still be factored into the computation.";
				message += "\nTo disable edge drawing, click cancel. To draw edges anyway, click OK.";
	
				if(confirm(message)){
				
					drawingEdges = true;
				
				} else {
				
					drawingEdges = false;
					drawEdgesCheckbox.checked = false;
					
				}
				
			}
	
			animate();
			
			startSimulationButton.value = "End simulation";
			
		} else{
		
			simulating = false;
			startSimulationButton.value = "Start simulation";
			clearTimeout(animationID);
			context.clearRect(0, 0, canvas.width, canvas.height);
			
			if(querying){
			
				querying = false;
				queryDiv.style.display = 'none';
				
			}
			
			if(paused){
			
				paused = false;
				pauseSimulationButton.value = "Pause simulation";
				
			}
			
		}
		
	});
	
	$(pauseSimulationButton).on('click', function(){
	
		if(simulating){
	
			if(!paused){ // pause
		
				paused = true;
				clearTimeout(animationID);
				pauseSimulationButton.value = "Unpause simulation";
			
			} else{ // unpause
		
				if(querying){
			
					querying = false;
					queryDiv.style.display = 'none';
					context.putImageData(imageData, 0, 0);
				
				}
			
				animationID = window.setTimeout(animate, 40);
				paused = false;
				pauseSimulationButton.value = "Pause simulation";
			
			}
			
		}
		
	});
	
	$(queryRegionButton).on('click', function () {
	
		if(!querying){
	
			if(!paused){
				pauseSimulationButton.click();	
			}
		
			var regionX = regionXTextbox.value;
			var regionY = regionYTextbox.value;
			var regionRadius = regionRadiusTextbox.value;
		
			imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		
			context.save();
			context.strokeStyle = '#000';
			context.lineWidth = 1;
			context.beginPath();
			context.arc(regionX, regionY, regionRadius, 0, 2*Math.PI, true);
			context.closePath();
			context.stroke();
			context.restore();
		
			querying = true;
			
			queryDiv.style.display = 'block';
			
			var queryRegionVertices = new Array();
			
			var setSize = 0;
			
			var resultString = "";
			
			for(var v = 0; v < vertices.length; v++){
			
				if(vertices[v].mobile){ // weeds out anchor vertices
				
					if(Math.pow(vertices[v].center.x - regionX, 2) + Math.pow(vertices[v].center.y - regionY, 2) < Math.pow(regionRadius, 2)){
					
						queryRegionVertices[v] = vertices[v];
						setSize++;
						resultString += (vertices[v].toString() + "<br />");
						
					}
					
				}
				
			}
			
			var edgeFound = false;
			
			for(var w = 0; w < queryRegionVertices.length; w++){
			
				if(queryRegionVertices[w] != null){
			
					for(var x = 0; x < queryRegionVertices[w].adjacentVertices.length; x++){
					
						if(queryRegionVertices[parseInt(queryRegionVertices[w].adjacentVertices[x].name.substring(2), 10)] != null){
						
							edgeFound = true;
							
							break;
							
						}
						
					}
					
				}
				
				if(edgeFound){
					break;
				}
				
			}
			
			if(edgeFound){
			
				independenceDiv.innerHTML = "Uh, oh! It appears that this set is not independent.";
				
			} else{
			
				independenceDiv.innerHTML = "Success! An independent set of size " + setSize + "! <span style='font-size: 0.6em;'><a href='http://www.thewire.com/entertainment/2012/01/target-kristen-wiigs-target-lady-approved/47866/'>I gotta get me one o' those.</a></span>";
				
			}
							
			resultsDiv.innerHTML = resultString;
			
		}
		
	});
	
	$(drawEdgesCheckbox).on('change', function () {
	
		if(simulating){
	
			if(numEdges < 1000){
	
				drawingEdges = drawEdgesCheckbox.checked;

			} else if(drawEdgesCheckbox.checked){

				var message = "Drawing more than 1000 edges is a bad idea unless you have a very fast computer.";
				message += "\nIf you choose not to draw the edges, they will still be factored into the computation.";
				message += "\nTo disable edge drawing, click cancel. To draw edges anyway, click OK.";

				if(confirm(message)){
	
					drawingEdges = true;
	
				} else {
	
					drawingEdges = false;
					drawEdgesCheckbox.checked = false;
		
				}
			
			}
			
		}
		
	});

}

function radToDeg(radians){
	
	return radians * (360/(2*Math.PI));
	
}

function calculate(){

	var timeStep = 1; // 1 seems good
	
	var force = {x: 0, y: 0}, forceComponent = {x: 0, y: 0};
	
	if(numVertices < 20 && numEdges/numVertices > 0.5){
	
		for(var a = 0; a < anchors.length; a++){
		
			a.mass = anchorMass;
			
		}
		
	}
	
	var unitVector = {x: 0, y: 0}, distanceSquared;
	
	var vertex, opposingVertices, opposingVertex;
	
	for(var i = 0; i < vertices.length; i++){
	
		force.x = force.y = 0;
		
		vertex = vertices[i];
		
		if(vertex.mobile){
		
			// if(numVertices > 20 && iteration % 4 == 0){
// 	
// 				// calculate new position
// 		
// 				vertex.center.x += vertex.velocity.x*timeStep + 0.5*vertex.acceleration.x * Math.pow(timeStep, 2);
// 				vertex.center.y += vertex.velocity.y*timeStep + 0.5*vertex.acceleration.y * Math.pow(timeStep, 2);
// 	
// 				return;
// 		
// 			}
		
		// first calculate force with adjacent vertices (repulsion)
		
			opposingVertices = vertex.adjacentVertices;
	
			for(var j = 0; j < opposingVertices.length; j++){
		
				opposingVertex = opposingVertices[j];
			
				// vector away from opposingVertex towards vertex
				unitVector.x = vertex.center.x - opposingVertex.center.x;
				unitVector.y = vertex.center.y - opposingVertex.center.y;
			
				distanceSquared = Math.pow((vertex.center.x - opposingVertex.center.x), 2) + 
					Math.pow((vertex.center.y - opposingVertex.center.y), 2);
				if(distanceSquared == 0){ 
					distanceSquared = Math.pow(10, -3);
				}
				forceComponent.x = repulsionFactor * vertex.mass * opposingVertex.mass * unitVector.x / distanceSquared;
				forceComponent.y = repulsionFactor * vertex.mass * opposingVertex.mass * unitVector.y / distanceSquared;
				force.x += forceComponent.x;
				force.y += forceComponent.y;
		
			}
		
			// then calculate force with nonadjacent vertices
		
			opposingVertices = vertex.nonAdjacentVertices;
		
			for(var j = 0; j < opposingVertices.length; j++){
		
				opposingVertex = opposingVertices[j];
		
				// vector away from vertex towards opposingVertex
				unitVector.x = opposingVertex.center.x - vertex.center.x;
				unitVector.y = opposingVertex.center.y - vertex.center.y;
			
				distanceSquared = Math.pow((vertex.center.x - opposingVertex.center.x), 2) + 
					Math.pow((vertex.center.y - opposingVertex.center.y), 2);
				if(distanceSquared <= 0.01){ 
					distanceSquared = 0.01;
				}
				forceComponent.x = attractionFactor * vertex.mass * opposingVertex.mass * unitVector.x / distanceSquared;
				forceComponent.y = attractionFactor * vertex.mass * opposingVertex.mass * unitVector.y / distanceSquared;
				force.x += forceComponent.x;
				force.y += forceComponent.y;
		
			}
		
			vertex.acceleration.x = force.x;
			vertex.acceleration.y = force.y;
			
			if(withWalls){
		
				// for collision with wall
		
				if(vertex.center.x <= 1.25*vertexRadius || vertex.center.y <= 1.25*vertexRadius || vertex.center.x >= (canvas.width - 1.25*vertexRadius) || vertex.center.y >= (canvas.height - 1.25*vertexRadius)){
			
					vertex.velocity.x *= -1;
					vertex.velocity.y *= -1;
			
				}
				
			}
		
			// calculate new position
		
			vertex.center.x += vertex.velocity.x*timeStep + 0.5*vertex.acceleration.x * Math.pow(timeStep, 2);
			vertex.center.y += vertex.velocity.y*timeStep + 0.5*vertex.acceleration.y * Math.pow(timeStep, 2);
		
			// calculate new velocity
		
			vertex.velocity.x += vertex.acceleration.x*timeStep;
			vertex.velocity.y += vertex.acceleration.y*timeStep;
			
			// imaginary friction
			
			vertex.velocity.x /= Math.max(1, ((3000 + iteration)/3000));
			vertex.velocity.y /= Math.max(1, ((3000 + iteration)/3000));
			
			// collisions with other vertices
			
			// for(var k = 0; k < vertices.length; k++){
// 			
// 				if((vertex.center.x - vertices[k].center.x) <= 2.1*vertexRadius && (vertex.center.y - vertices[k].center.y <= 2.1*vertexRadius)){
// 				
// 					vertex.velocity.x *= -1;
// 					vertex.velocity.y *= -1;
// 					
// 				}
// 				
// 			}
			
			// for collision with anchor
			
			// for(var k = 0; k < anchors.length; k++){
// 			
// 				if(vertex.center.x >= (anchors[k].center.x - 2*vertexRadius) && vertex.center.x < (anchors[k].center.x + 2*vertexRadius) && vertex.center.y >= (anchors[k].center.y - 2*vertexRadius) && vertex.center.y < (anchors[k].center.y + 2*vertexRadius)){
// 				
// 					if(vertex.center.x < anchors[k].center.x){
// 					
// 						vertex.center.x = anchors[k].center.x - 2*vertexRadius;
// 						
// 					} else if(vertex.center.x >= anchors[k].center.x){
// 					
// 						vertex.center.x = anchors[k].center.x + 2*vertexRadius;
// 						
// 					} else if(vertex.center.y < anchors[k].center.y){
// 					
// 						vertex.center.y = anchors[k].center.y - 2*vertexRadius;
// 						
// 					} else if(vertex.center.y >= anchors[k].center.y){
// 					
// 						vertex.center.y = anchors[k].center.y + 2*vertexRadius;
// 						
// 					}
// 
// 				}
// 				
// 			}
			
		} // end if(vertex.mobile)
		
	} // end for loop

} // function calculate()

function animate(){
	
	// calculate changes	
	
	// clear the canvas

	context.clearRect(0, 0, canvas.width, canvas.height);
	
	// draw edges if checked
	
	if(drawingEdges){
	
		for(var i = 0; i < edges.length; i++){
			edges[i].render();
		}
		
	}

	// draw vertices

	for(var i = 0; i < vertices.length; i++){
		vertices[i].render();
	}
	
	// if(iteration < 3){
// 
// 		printVertices();
// 		
// 	}
	
	calculate();

	animationID = window.setTimeout(animate, 40);
	
	iteration++;
	
}

function printVertices(){

	for(var i = 0; i < vertices.length; i++){

		console.log("vertex: " + vertices[i].name);
		console.log("\nposition: {x: " + vertices[i].center.x + ", y: " + vertices[i].center.y);
		console.log("\nvelocity: {x: " + vertices[i].velocity.x + ", y: " + vertices[i].velocity.y);
		console.log("\nacceleration: {x: " + vertices[i].acceleration.x + ", y: " + vertices[i].acceleration.y);
		console.log("===============");
		
	}
	
}

function decToHex(number){

	var hexDigits = new Array();
	var quotient;
	var remainder;
	
	while(number > 0){
	
		remainder = number % 16;
		switch(remainder){
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

function hexToDec(string){
	
	if(string.charAt(0) == '#'){
	
		string = string.substring(1);
		
	} else if(string.charAt(1) == 'x'){
	
		string = string.substring(2);
		
	}
	
	var decimal = 0;
	var value;
	var translatedValue;
	var power;
	var digit;

	for(var i = string.length - 1; i >=0; i--){
	
		value = string.charAt(i);
		translatedValue = parseInt(value, 16);
		power = string.length - i - 1;
		digit = translatedValue * Math.pow(16, power);
		decimal += digit;	
		
	}
	
	return decimal;
	
}

$(window).on('load', function () {
	init();
});