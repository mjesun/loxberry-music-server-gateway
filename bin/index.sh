#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null 2>&1 && pwd)"

while true; do
  node $DIR/service/index.js

  case $? in
    254)
      # Immediate reload.
    ;;

    0)
      exit 0
    ;;

    *)
      sleep 5
    ;;
  esac
done
