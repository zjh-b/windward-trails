from playwright.sync_api import sync_playwright
from browser_qa import local_url,attach,ready,select,drive_stage

with local_url(None) as url,sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        page=browser.new_page(viewport={'width':1440,'height':960})
        errors=[];resources=[];attach(page,'lagoon-diagnostic',errors,resources)
        page.goto(url);ready(page);select(page,'hero',3);page.click('#start')
        drive_stage(page,3,[])
    finally:browser.close()
