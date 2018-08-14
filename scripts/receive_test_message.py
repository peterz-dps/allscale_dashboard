#!/usr/bin/env python3

import socket
import struct


with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect(("localhost", 1337))

    print("Waiting...")

    l = struct.unpack("!Q", s.recv(8))[0]
    payload = s.recv(l)
    msg = struct.unpack("!%ds" % l, payload)[0]

    print(msg)
