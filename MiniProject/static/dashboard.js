function simulateVehicle(vehicleId){

let data = {

engine_temp: Math.floor(Math.random()*40)+70,
vibration_level: Math.floor(Math.random()*10),
battery_voltage: Math.floor(Math.random()*4)+11,
engine_rpm: Math.floor(Math.random()*4000)+800,
fuel_level: Math.floor(Math.random()*100),
mileage: Math.floor(Math.random()*200000)

};

fetch("/predict",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(data)

})

.then(response => response.json())

.then(result => {

document.getElementById("status"+vehicleId).innerText = result.prediction;

});

}


// Chart.js graph

const ctx = document.getElementById('tempChart');

new Chart(ctx,{

type:'line',

data:{
labels:["1","2","3","4","5"],
datasets:[{

label:"Engine Temperature",

data:[70,75,80,90,85],

borderColor:"red",

fill:false

}]
}

});