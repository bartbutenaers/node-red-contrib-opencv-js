module.exports = function(RED) {
    "use strict";
    var cv   = require('opencv.js');
    var jpeg = require('jpeg-js');

    function ObjectDetectorNode(config) {
        RED.nodes.createNode(this,config);
        this.display = config.display;

        var busy = false;
        var yuvMat = null;
        var rgbMat = null;
        var grayMat = null;
         
        var node = this;
        
        // Load the classifier with the frontal face model
        var faceClassifier = new cv.CascadeClassifier();
        faceClassifier.load('../classifiers/haarcascade_frontalface_default.xml');
        
        this.on("input",function(msg) {
            var buffer = msg.payload;
            
            // Don't process multiple images simultaneously, to avoid segmentation errors
            if (busy) {
                return;
            }
            
            busy = true;
            
            if (!Buffer.isBuffer(buffer)) {
                buffer = Buffer.from(buffer);
            }
            
            // Decode the JPEG compressed image to a raw image (i.e. real pixels)
            var rawImage = jpeg.decode(buffer, true);
             
            var imageHeight = rawImage.height;
            var imageWidth  = rawImage.width;
 
            if (!yuvMat) {
                yuvMat = new cv.Mat(imageHeight, imageWidth, cv.CV_8UC2);
            }
            yuvMat.data.set(rawImage);
            
            if (!rgbMat) {
                rgbMat = new cv.Mat(imageHeight, imageWidth, cv.CV_8UC4);
            }
            cv.cvtColor(yuvMat, rgbMat, cv.COLOR_YUV2RGBA_YUYV);
  
            if (!grayMat) {
                grayMat = new cv.Mat(imageHeight, imageWidth, cv.CV_8UC1);
            }
            cv.cvtColor(rgbMat, grayMat, cv.COLOR_RGBA2GRAY);
 
            var faces = [];
            var eyes = [];
            var size;
            var faceVect = new cv.RectVector();
            var faceMat = new cv.Mat();
 
            // Scale down the raw image
            cv.pyrDown(grayMat, faceMat);
            if (imageWidth > 320) {
                cv.pyrDown(faceMat, faceMat);
            }
            size = faceMat.size();
 
            // Process the raw image to find faces
            faceClassifier.detectMultiScale(faceMat, faceVect);
 
            // Draw rectangle around faces
            for (var i = 0; i < faceVect.size(); i++) {
                var xRatio = imageWidth/size.width;
                var yRatio = imageHeight/size.height;
                var face = faceVect.get(i);
                var x = face.x*xRatio;
                var y = face.y*yRatio;
                var w = face.width*xRatio;
                var h = face.height*yRatio;
                var point1 = new cv.Point(x, y);
                var point2 = new cv.Point(x + w, y + h);
                
                cv.rectangle(rgbMat, point1, point2, [255, 0, 0, 255]);
                node.log('\tFace detected : ' + '[' + i + ']' + ' (' + x + ', ' + y + ', ' + w + ', ' + h + ')');
            }
 
            // Free the memory used by vectors
            faceMat.delete();
            faceVect.delete(); 
        });
 
        this.on("close", function() {
            rawData = { data: rgbMat.data, width: rgbMat.size().width, height: rgbMat.size().height };
            var jpegData = jpeg.encode(rawData, 50);
            node.send({payload: jpegData});
    
            yuvMat.delete();
            rgbMat.delete();
            grayMat.delete();
        });
    }

    RED.nodes.registerType("object-detector",ObjectDetectorNode);
}
