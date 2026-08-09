#!/bin/sh
set -e

./main artisan migrate

exec ./main
