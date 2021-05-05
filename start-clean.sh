#!/bin/sh
rm -rf ./camunda-h2-default
rm -rf ./camunda-optimize-3.4.0-demo/elasticsearch/elasticsearch-7.10.0/data/
sh ./camunda/start.sh &
sh ./camunda-optimize-3.4.0-demo/optimize-demo.sh & 