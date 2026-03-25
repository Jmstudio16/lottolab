"""
Tests pour le moteur de calcul des gains (PayoutEngine)
======================================================
Vérifie les règles officielles haïtiennes:
- Borlette 60/20/10
- Loto 3, Loto 4, Loto 5
- Mariage
"""

import pytest
from payout_engine import (
    extract_borlette_number,
    calculate_borlette_win,
    calculate_loto3_win,
    calculate_loto4_win,
    calculate_loto5_win,
    calculate_mariage_win,
    parse_prime,
    calculate_play_win
)


class TestExtractBorlette:
    """Test extraction du numéro Borlette (2 derniers chiffres du 1er prix)"""
    
    def test_extract_from_123(self):
        """1er prix 123 → Borlette 23"""
        assert extract_borlette_number("123") == "23"
    
    def test_extract_from_456(self):
        """1er prix 456 → Borlette 56"""
        assert extract_borlette_number("456") == "56"
    
    def test_extract_from_100(self):
        """1er prix 100 → Borlette 00"""
        assert extract_borlette_number("100") == "00"
    
    def test_extract_empty(self):
        """Empty input returns empty"""
        assert extract_borlette_number("") == ""


class TestParsePrime:
    """Test parsing des formules de prime"""
    
    def test_parse_borlette_formula(self):
        """Parse 60|20|10"""
        result = parse_prime("60|20|10")
        assert result == [60.0, 20.0, 10.0]
    
    def test_parse_single_value(self):
        """Parse 500"""
        result = parse_prime("500")
        assert result == [500.0]
    
    def test_parse_empty(self):
        """Empty returns [0]"""
        result = parse_prime("")
        assert result == [0.0]


class TestBorlette:
    """Tests Borlette avec règle 60/20/10"""
    
    def test_borlette_1er_rang(self):
        """
        Résultat: 1er=123, 2ème=45, 3ème=78
        Joueur joue 23 pour 10 HTG → gagne 600 HTG (1er rang)
        """
        is_winner, amount, match = calculate_borlette_win(
            played_number="23",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="60|20|10"
        )
        assert is_winner == True
        assert amount == 600.0
        assert match == "1er_rang"
    
    def test_borlette_2eme_rang(self):
        """
        Résultat: 1er=123, 2ème=45, 3ème=78
        Joueur joue 45 pour 10 HTG → gagne 200 HTG (2ème rang)
        """
        is_winner, amount, match = calculate_borlette_win(
            played_number="45",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="60|20|10"
        )
        assert is_winner == True
        assert amount == 200.0
        assert match == "2eme_rang"
    
    def test_borlette_3eme_rang(self):
        """
        Résultat: 1er=123, 2ème=45, 3ème=78
        Joueur joue 78 pour 10 HTG → gagne 100 HTG (3ème rang)
        """
        is_winner, amount, match = calculate_borlette_win(
            played_number="78",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="60|20|10"
        )
        assert is_winner == True
        assert amount == 100.0
        assert match == "3eme_rang"
    
    def test_borlette_perdant(self):
        """
        Résultat: 1er=123, 2ème=45, 3ème=78
        Joueur joue 12 → perd
        """
        is_winner, amount, match = calculate_borlette_win(
            played_number="12",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="60|20|10"
        )
        assert is_winner == False
        assert amount == 0.0
    
    def test_borlette_custom_prime(self):
        """Test avec prime personnalisée 70|25|15"""
        is_winner, amount, match = calculate_borlette_win(
            played_number="23",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="70|25|15"
        )
        assert is_winner == True
        assert amount == 700.0  # 10 × 70


class TestLoto3:
    """Tests Loto 3 - match exact des 3 chiffres"""
    
    def test_loto3_gagnant(self):
        """
        Résultat 1er = 123, Prime Loto3 = 500
        Joueur joue 123 pour 10 HTG → gagne 5000 HTG
        """
        is_winner, amount, match = calculate_loto3_win(
            played_number="123",
            first_prize="123",
            bet_amount=10,
            prime_formula="500"
        )
        assert is_winner == True
        assert amount == 5000.0
        assert match == "exact"
    
    def test_loto3_perdant(self):
        """
        Résultat 1er = 123
        Joueur joue 124 → perd
        """
        is_winner, amount, match = calculate_loto3_win(
            played_number="124",
            first_prize="123",
            bet_amount=10,
            prime_formula="500"
        )
        assert is_winner == False
        assert amount == 0.0


class TestLoto4:
    """Tests Loto 4 - match exact des 4 chiffres"""
    
    def test_loto4_gagnant(self):
        """Loto4 gagnant avec prime 5000"""
        is_winner, amount, match = calculate_loto4_win(
            played_number="1234",
            winning_number="1234",
            bet_amount=10,
            prime_formula="5000"
        )
        assert is_winner == True
        assert amount == 50000.0  # 10 × 5000
    
    def test_loto4_perdant(self):
        """Loto4 perdant"""
        is_winner, amount, match = calculate_loto4_win(
            played_number="1235",
            winning_number="1234",
            bet_amount=10,
            prime_formula="5000"
        )
        assert is_winner == False


class TestLoto5:
    """Tests Loto 5 - match exact des 5 chiffres"""
    
    def test_loto5_gagnant(self):
        """Loto5 gagnant avec prime 50000"""
        is_winner, amount, match = calculate_loto5_win(
            played_number="12345",
            winning_number="12345",
            bet_amount=10,
            prime_formula="50000"
        )
        assert is_winner == True
        assert amount == 500000.0  # 10 × 50000


class TestMariage:
    """Tests Mariage - 2 numéros combinés"""
    
    def test_mariage_gagnant(self):
        """
        Résultat: 1er=123, 2ème=45, 3ème=78
        Mariage 23x45 gagne (23 = borlette, 45 = 2ème)
        """
        is_winner, amount, match = calculate_mariage_win(
            played_numbers="23x45",
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="750"
        )
        assert is_winner == True
        assert amount == 7500.0  # 10 × 750
    
    def test_mariage_perdant(self):
        """Mariage perdant - un seul numéro présent"""
        is_winner, amount, match = calculate_mariage_win(
            played_numbers="23x99",  # 99 n'est pas dans les résultats
            first_prize="123",
            second_prize="45",
            third_prize="78",
            bet_amount=10,
            prime_formula="750"
        )
        assert is_winner == False


class TestCalculatePlayWin:
    """Test de la fonction principale de calcul par jeu"""
    
    def test_play_with_prime_at_sale(self):
        """Utilise le snapshot prime_at_sale si disponible"""
        play = {
            "numbers": "23",
            "bet_type": "BORLETTE",
            "amount": 10,
            "prime_at_sale": "70|25|15"  # Prime au moment de la vente
        }
        winning_numbers = {"first": "123", "second": "45", "third": "78"}
        primes = {"BORLETTE": "60|20|10"}  # Prime actuelle différente
        
        result = calculate_play_win(play, winning_numbers, primes)
        
        # Doit utiliser 70 (prime_at_sale), pas 60 (prime actuelle)
        assert result["is_winner"] == True
        assert result["win_amount"] == 700.0  # 10 × 70


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
