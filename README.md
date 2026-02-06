# astsim

A simple AST (Abstract Syntax Tree) simulator for evaluating basic expressions.

## Installation

```bash
pip install -e .
```

Or install with development dependencies:

```bash
pip install -e ".[dev]"
```

## Usage

```python
from astsim import ASTNode, ASTSimulator

# Create a simple expression: 5 + 3
sim = ASTSimulator()
left = ASTNode('literal', 5)
right = ASTNode('literal', 3)
add_node = ASTNode('binary_op', '+', [left, right])

result = sim.evaluate(add_node)
print(result)  # Output: 8

# Use variables
sim.set_variable('x', 10)
sim.set_variable('y', 20)

# Evaluate: x + y
expr = ASTNode('binary_op', '+', [
    ASTNode('identifier', 'x'),
    ASTNode('identifier', 'y')
])

result = sim.evaluate(expr)
print(result)  # Output: 30
```

## Running Tests

```bash
pytest
```

## Features

- Create and manipulate Abstract Syntax Tree nodes
- Evaluate expressions with literals and variables
- Support for basic arithmetic operations (+, -, *, /)
- Nested expression evaluation

## License

MIT
