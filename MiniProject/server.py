from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)

model = joblib.load("fleet_ai_model.pkl")

@app.route("/")
def dashboard():
    return render_template("dashboard.html")

@app.route("/predict", methods=["POST"])
def predict():

    data = request.json

    input_data = pd.DataFrame([{
        "engine_temp": data["engine_temp"],
        "vibration_level": data["vibration_level"],
        "battery_voltage": data["battery_voltage"],
        "engine_rpm": data["engine_rpm"],
        "fuel_level": data["fuel_level"],
        "mileage": data["mileage"]
    }])

    prediction = model.predict(input_data)

    if prediction[0] == 1:
        result = "Maintenance Required"
    else:
        result = "Vehicle Healthy"

    return jsonify({"prediction": result})

if __name__ == "__main__":
    app.run(debug=True)