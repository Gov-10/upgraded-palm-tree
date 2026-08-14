import os, json
from dotenv import load_dotenv
load_dotenv()
from twilio.rest import Client
from kafka import KafkaConsumer
twilio_client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
consumer = KafkaConsumer("whatsapp", bootstrap_servers=os.getenv("BOOTSTRAP_SERVER"), value_deserializer=lambda x:json.loads(x.decode()), group_id="whatsapp_handle")
for msg in consumer:
    data = msg.value 
    normal, username, csv_file, source= data["normal"], data["csv_file"], data["source"], data["username"]
    if source == "whatsapp":
        phone = username
        message_body=(f"Parsed successfully\nInvoice CSV: {csv_file}\nContent:{normal}\n")
        twilio_client.messages.create(from_=os.getenv("TWILIO_WHATSAPP_NUMBER"), body=message_body, to=f"whatsapp:{phone}")


