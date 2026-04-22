SHELL := /bin/bash
SRC_FILES := $(shell find src -name '*.ts')
TEST_FILES := $(shell find test/tests -name '*.ts' 2>/dev/null)
BIN := ./node_modules/.bin
MOCHA_OPTS := -u tdd -r ts-node/register -r tsconfig-paths/register --extension ts

lib: ${SRC_FILES} package.json tsconfig.json node_modules rollup.config.mjs
	@${BIN}/rollup -c && touch lib

.PHONY: test
test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' \
		${BIN}/mocha ${MOCHA_OPTS} ${TEST_FILES} --grep '$(grep)'

.PHONY: check
check: node_modules
	@${BIN}/eslint src --ext .ts --max-warnings 0 --format unix && echo "Ok"

.PHONY: format
format: node_modules
	@${BIN}/eslint src --ext .ts --fix

node_modules:
	yarn install --non-interactive --ignore-scripts

.PHONY: clean
clean:
	rm -rf lib/ build/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
