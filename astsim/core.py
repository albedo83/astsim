"""
Core functionality for AST simulation
"""


class ASTNode:
    """Represents a node in an Abstract Syntax Tree"""
    
    def __init__(self, node_type, value=None, children=None):
        """
        Initialize an AST node
        
        Args:
            node_type (str): The type of the node (e.g., 'literal', 'binary_op', 'identifier')
            value: The value associated with the node (optional)
            children (list): List of child nodes (optional)
        """
        self.node_type = node_type
        self.value = value
        self.children = children or []
    
    def __repr__(self):
        if self.value is not None:
            return f"ASTNode({self.node_type}, {self.value})"
        return f"ASTNode({self.node_type})"
    
    def add_child(self, child):
        """Add a child node to this node"""
        self.children.append(child)
        return self


class ASTSimulator:
    """Simulator for evaluating simple AST expressions"""
    
    def __init__(self):
        self.variables = {}
    
    def evaluate(self, node):
        """
        Evaluate an AST node
        
        Args:
            node (ASTNode): The node to evaluate
            
        Returns:
            The result of evaluating the node
        """
        if node.node_type == 'literal':
            return node.value
        
        elif node.node_type == 'identifier':
            if node.value not in self.variables:
                raise ValueError(f"Undefined variable: {node.value}")
            return self.variables[node.value]
        
        elif node.node_type == 'binary_op':
            if len(node.children) != 2:
                raise ValueError(f"Binary operator requires exactly 2 children, got {len(node.children)}")
            left = self.evaluate(node.children[0])
            right = self.evaluate(node.children[1])
            
            if node.value == '+':
                return left + right
            elif node.value == '-':
                return left - right
            elif node.value == '*':
                return left * right
            elif node.value == '/':
                return left / right
            else:
                raise ValueError(f"Unknown operator: {node.value}")
        
        else:
            raise ValueError(f"Unknown node type: {node.node_type}")
    
    def set_variable(self, name, value):
        """Set a variable value"""
        self.variables[name] = value
