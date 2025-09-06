from fastapi import FastAPI,Request,status
from fastapi.responses import RedirectResponse

app=FastAPI()

@app.get('/user')
def user_information():
    return{"hello man you good"}

@app.get('/redirects/{id}' )
def redirect_links(id:int):
    if id==1:
        return RedirectResponse(url='https://youtu.be/P6vVNzp4x3s?si=dVe4pd4cMeAzVz4H')
    elif id==2:
        return RedirectResponse(url='https://youtu.be/7DQEQPlBNVM?si=wMoT9rYVyf9qzk7V' )
    elif id==3:
        return RedirectResponse(url='https//www.facebook.com')
    else:
        return {'sorry not found'}


    
