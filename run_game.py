"""Optional local launcher. The game also works by opening index.html directly."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def main():
    parser=argparse.ArgumentParser(description='Launch Windward Trails locally')
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    handler=functools.partial(SimpleHTTPRequestHandler,directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1',args.port),handler) as server:
        url=f'http://127.0.0.1:{server.server_port}/'
        print(f'Windward Trails: {url}',flush=True)
        print('Keep this window open. Press Ctrl+C to stop.',flush=True)
        if not args.no_browser:
            timer=threading.Timer(.3,lambda:webbrowser.open(url));timer.daemon=True;timer.start()
        try:server.serve_forever()
        except KeyboardInterrupt:pass


if __name__=='__main__':main()
