#!/usr/bin/env python3

import socket
import struct


MESSAGE = b'{"type": "test"}'


with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect(("localhost", 1337))

    msg = struct.pack("!Q%ds" % len(MESSAGE), len(MESSAGE), MESSAGE)

    s.sendall(msg)
    s.sendall(msg)
    s.sendall(msg)
