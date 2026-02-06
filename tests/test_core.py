"""
Tests for astsim core functionality
"""

import pytest
from astsim import ASTNode, ASTSimulator


class TestASTNode:
    """Tests for ASTNode class"""
    
    def test_create_literal_node(self):
        """Test creating a literal node"""
        node = ASTNode('literal', 42)
        assert node.node_type == 'literal'
        assert node.value == 42
        assert node.children == []
    
    def test_create_node_with_children(self):
        """Test creating a node with children"""
        child1 = ASTNode('literal', 1)
        child2 = ASTNode('literal', 2)
        parent = ASTNode('binary_op', '+', [child1, child2])
        
        assert len(parent.children) == 2
        assert parent.children[0].value == 1
        assert parent.children[1].value == 2
    
    def test_add_child(self):
        """Test adding a child to a node"""
        parent = ASTNode('binary_op', '+')
        child = ASTNode('literal', 5)
        
        parent.add_child(child)
        assert len(parent.children) == 1
        assert parent.children[0].value == 5
    
    def test_repr(self):
        """Test string representation of node"""
        node1 = ASTNode('literal', 42)
        assert 'literal' in repr(node1)
        assert '42' in repr(node1)
        
        node2 = ASTNode('identifier')
        assert 'identifier' in repr(node2)


class TestASTSimulator:
    """Tests for ASTSimulator class"""
    
    def test_evaluate_literal(self):
        """Test evaluating a literal node"""
        sim = ASTSimulator()
        node = ASTNode('literal', 42)
        result = sim.evaluate(node)
        assert result == 42
    
    def test_evaluate_addition(self):
        """Test evaluating addition"""
        sim = ASTSimulator()
        left = ASTNode('literal', 5)
        right = ASTNode('literal', 3)
        add_node = ASTNode('binary_op', '+', [left, right])
        
        result = sim.evaluate(add_node)
        assert result == 8
    
    def test_evaluate_subtraction(self):
        """Test evaluating subtraction"""
        sim = ASTSimulator()
        left = ASTNode('literal', 10)
        right = ASTNode('literal', 3)
        sub_node = ASTNode('binary_op', '-', [left, right])
        
        result = sim.evaluate(sub_node)
        assert result == 7
    
    def test_evaluate_multiplication(self):
        """Test evaluating multiplication"""
        sim = ASTSimulator()
        left = ASTNode('literal', 4)
        right = ASTNode('literal', 5)
        mul_node = ASTNode('binary_op', '*', [left, right])
        
        result = sim.evaluate(mul_node)
        assert result == 20
    
    def test_evaluate_division(self):
        """Test evaluating division"""
        sim = ASTSimulator()
        left = ASTNode('literal', 20)
        right = ASTNode('literal', 4)
        div_node = ASTNode('binary_op', '/', [left, right])
        
        result = sim.evaluate(div_node)
        assert result == 5.0
    
    def test_evaluate_nested_expression(self):
        """Test evaluating nested expressions"""
        sim = ASTSimulator()
        # (2 + 3) * 4 = 20
        left = ASTNode('binary_op', '+', [
            ASTNode('literal', 2),
            ASTNode('literal', 3)
        ])
        right = ASTNode('literal', 4)
        mul_node = ASTNode('binary_op', '*', [left, right])
        
        result = sim.evaluate(mul_node)
        assert result == 20
    
    def test_variables(self):
        """Test using variables"""
        sim = ASTSimulator()
        sim.set_variable('x', 10)
        
        node = ASTNode('identifier', 'x')
        result = sim.evaluate(node)
        assert result == 10
    
    def test_undefined_variable(self):
        """Test that undefined variables raise an error"""
        sim = ASTSimulator()
        node = ASTNode('identifier', 'undefined_var')
        
        with pytest.raises(ValueError, match="Undefined variable"):
            sim.evaluate(node)
    
    def test_expression_with_variables(self):
        """Test evaluating expressions with variables"""
        sim = ASTSimulator()
        sim.set_variable('x', 5)
        sim.set_variable('y', 3)
        
        # x + y
        add_node = ASTNode('binary_op', '+', [
            ASTNode('identifier', 'x'),
            ASTNode('identifier', 'y')
        ])
        
        result = sim.evaluate(add_node)
        assert result == 8
    
    def test_unknown_operator(self):
        """Test that unknown operators raise an error"""
        sim = ASTSimulator()
        node = ASTNode('binary_op', '%', [
            ASTNode('literal', 5),
            ASTNode('literal', 2)
        ])
        
        with pytest.raises(ValueError, match="Unknown operator"):
            sim.evaluate(node)
    
    def test_unknown_node_type(self):
        """Test that unknown node types raise an error"""
        sim = ASTSimulator()
        node = ASTNode('unknown_type', 42)
        
        with pytest.raises(ValueError, match="Unknown node type"):
            sim.evaluate(node)
    
    def test_binary_op_invalid_children_count(self):
        """Test that binary operators with wrong number of children raise an error"""
        sim = ASTSimulator()
        # Only one child
        node = ASTNode('binary_op', '+', [ASTNode('literal', 5)])
        
        with pytest.raises(ValueError, match="exactly 2 children"):
            sim.evaluate(node)
        
        # Three children
        node = ASTNode('binary_op', '+', [
            ASTNode('literal', 5),
            ASTNode('literal', 3),
            ASTNode('literal', 2)
        ])
        
        with pytest.raises(ValueError, match="exactly 2 children"):
            sim.evaluate(node)
