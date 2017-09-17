/////////////////////////////////////////////////////////////////////////////
var cmdSize = 16;
var cmdGamepad = new Uint8Array(cmdSize);
var cmdQueue = [];

key_dict = {
    "cross_x":0,
    "cross_y":0,
    "L3D_x":0,
    "L3D_y":0,
    "R3D_x":0,
    "R3D_y":0,
    "RT":0,
    "LT":0,
    "A":0,
    "B":0,
    "X":0,
    "Y":0,
    "RB":0,
    "LB":0,
    "BACK":0,
    "START":0
};

////////////////////////////////////////////////////////////////////////////

var mqtt = require('mqtt');
var options = {
    port: 1883,
    host: 'mqtt://flandre.local:1883',
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    keepalive: 60,
    reconnectPeriod: 1000,
    clean: false,
    protocolId: "MQTT",
    protocolVersion: 4,
};

var mqtt_client = mqtt.connect('mqtt://flandre.local:1883', options);
mqtt_client.subscribe("gamepad/#");
mqtt_client.subscribe("cmd/#");


mqtt_client.on('connect', function() {
    mqtt_client.publish('presence', 'This is uMouse BTtoMQTT.js');
    console.log("MQTTで接続")
});

mqtt_client.on('message', function(topic, message, packet) {
    //console.log(message.toString() + " : " + topic);
    var topic_array = topic.split("/");
    var message_array = message;
    //console.log(topic_array);
    //console.log(message);
    topic = topic_array[0];
    payload = message;

    if (topic == "gamepad") {
        key_dict = JSON.parse(payload);
        cmdGamepad[0] = 99;
        cmdGamepad[1] = 109;
        cmdGamepad[2] = 100;
        cmdGamepad[3] = 254;
        cmdGamepad[4] = 253;
        cmdGamepad[9] = 128;
        cmdGamepad[10] = 128;
        cmdGamepad[11] = 128;
        cmdGamepad[12] = 128;
        cmdGamepad[13] = 128;
        cmdGamepad[14] = 128;

        cmdGamepad[6] = key_dict["A"] +
                 (key_dict["B"] << 1) +
                 (key_dict["X"] << 2) +
                 (key_dict["Y"] << 3) +
                 (key_dict["RB"] << 4) +
                 (key_dict["LB"] << 5) +
                 (key_dict["BACK"] << 6) +
                 (key_dict["START"] << 7);
        cmdGamepad[7] = key_dict["RT"];
        cmdGamepad[8] = key_dict["LT"];

        cmdGamepad[9] = key_dict["cross_x"] + 128;
        cmdGamepad[10] = key_dict["cross_y"] + 128;
        cmdGamepad[11] = Math.round(key_dict["R3D_x"] / 256 + 128);
        cmdGamepad[12] = Math.round(key_dict["R3D_y"] / 256 + 128);
        cmdGamepad[13] = Math.round(key_dict["L3D_x"] / 256 + 128);
        cmdGamepad[14] = Math.round(key_dict["L3D_y"] / 256 + 128);
        cmdGamepad[15] = 252;

        chk_sum = 0
        for( var i=6;i<cmdSize;i++){
            chk_sum += cmdGamepad[i];
        }
        cmdGamepad[5] = chk_sum % 256; //  チェックサム
        console.log(cmdGamepad);
    }
    console.log(topic);
    if (topic == "cmd") {
      cmdQueue.push(message);
      //console.log(cmdQueue);
    }


});



/////////////////////////////////////////////////////////////////////////////

var Serialport = require('serialport')
var head = 0;
var tail = 0;
var buffSize = 1024;
var recieveBuff = new Uint8Array(buffSize);
var mouseMessageLen = 400;
var sendData = new Uint8Array(mouseMessageLen);
var timestamp = 0;
var timestamp_pre = 0;
var lastRecieveTime = new Date();

function deleteHead(length){
    head = (head + length) % buffSize;
};

function insertTail(array){
    for(var i=0; i<array.length; i++){
        recieveBuff[tail] = array[i];
        tail = (tail + 1) % buffSize;
    }
};

function findHeader(){
    var i = head;
    indList = [];
    while( (i%buffSize)  != ((tail-6+buffSize)%buffSize)){
        if(recieveBuff[i%buffSize] == 0xff &&
           recieveBuff[(i+1)%buffSize] == 0xff &&
           recieveBuff[(i+2)%buffSize] == 0x48 &&
           recieveBuff[(i+3)%buffSize] == 0x45 &&
           recieveBuff[(i+4)%buffSize] == 0x41 &&
           recieveBuff[(i+5)%buffSize] == 0x44

        ){indList.push(i);}
        i=(i+1)%buffSize;
    }
    return indList;
};

function getCount(){
    return (tail - head +buffSize)%buffSize;
};

function byte_to_hex(byte_num)
{
	var digits = (byte_num).toString(16);
    if (byte_num < 16) return '0' + digits;
    return digits;
}

function bytes_to_hex_string(bytes){
    var result = "";

    for (var i = 0; i < bytes.length; i++) {
            result += byte_to_hex(bytes[i]);
        }
    return result;
};

// Serial Port
var portName = '/dev/rfcomm1';
var SerialPort = require('serialport');
var port = new SerialPort('/dev/rfcomm1', {
  baudRate: 2000000,
  autoOpen: true,
  highWaterMark:32768
},function(){
    console.log(port.isOpen);
    var time = new Date();
    elapsedTime = time.getTime() - lastRecieveTime.getTime();

    console.log(elapsedTime);
    if(port.isOpen == false ){
      console.log(port.isOpen);
      console.log("open err");
      process.exit(1);
    }

      setTimeout(function(){
        var time = new Date();
        elapsedTime = time.getTime() - lastRecieveTime.getTime();
        if(elapsedTime > 3900){
            mqtt_client.publish("TEST", "Cannot connect Bluetooth");
            console.log(elapsedTime + "exit connect err");
            console.log("time out");
            process.exit(1);
        }
    }, 4000);
});


port.on('data', function(input) {
    insertTail(input);
    indList = findHeader();
    lastRecieveTime = new Date();

    setTimeout(function(){
        var time = new Date();
        elapsedTime = time.getTime() - lastRecieveTime.getTime();
        if(elapsedTime > 400){
            console.log("exit");
            mqtt_client.publish("TEST","Bluetooth conection lost!");
            process.exit(1);

        }
    }, 500);


    if(indList.length>1){
        head = indList[0];

        dataSize = (indList[1] - indList[0] + buffSize)%buffSize;
        if(dataSize > mouseMessageLen) dataSize = mouseMessageLen;
        for(var i=0;i<dataSize;i++){
            sendData[i] = recieveBuff[(i+head)%buffSize];
        }
        deleteHead(dataSize);
        timestamp_pre = timestamp;
        timestamp = sendData[11];
        chk_sum = 0;
        for(var i=7;i<mouseMessageLen;i++){
            chk_sum+=sendData[i];
        }
        chk_sum = chk_sum % 256;
        mqtt_client.publish('mouse', new Buffer(sendData, 'utf8'));
        port.write(new Buffer(cmdGamepad));
        if(cmdQueue.length !=0){
          port.write(cmdQueue[0]);
          cmdQueue.shift();
        }

        if(chk_sum != sendData[6] || (timestamp - timestamp_pre+256)%256 != 20){
            //console.log(dataSize+ " " + sendData[11] + " " + chk_sum + " " + sendData[6]);
            //console.log(bytes_to_hex_string(recieveBuff));
            mqtt_client.publish('error', dataSize+ " " + sendData[11] + " " + chk_sum + " " + sendData[6]);
        }
        else{
            //console.log("ok " + sendData[11]);
        }

    }

});
