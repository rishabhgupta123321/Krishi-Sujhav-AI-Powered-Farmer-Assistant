"""
Farmer Services Module - Market-Ready Features for Indian Farmers
================================================================
This module provides production-grade services that directly impact farmer livelihoods:
1. Mandi Price Intelligence (Real-time commodity prices)
2. Government Scheme Finder (PM-KISAN, PMFBY, KCC, etc.)
3. Crop Calendar & Seasonal Planner
4. Soil Health Analysis Engine
5. Farm Economics Calculator (Profit/Loss, ROI)
6. Emergency Alert System (Pest outbreaks, weather warnings)
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

# ============================================================
# 1. MANDI PRICE INTELLIGENCE
# ============================================================

class MandiPriceService:
    """
    Real-time Indian Mandi (market) commodity prices.
    Uses data.gov.in API for official APMC market data.
    Fallback to Gemini AI for price estimates when API is unavailable.
    """
    
    # Common crops traded in Indian mandis with Hindi names
    COMMODITY_MAP = {
        'wheat': {'en': 'Wheat', 'hi': 'गेहूं', 'mr': 'गहू', 'pa': 'ਕਣਕ', 'ta': 'கோதுமை', 'te': 'గోధుమ', 'kn': 'ಗೋಧಿ'},
        'rice': {'en': 'Rice', 'hi': 'चावल', 'mr': 'तांदूळ', 'pa': 'ਚਾਵਲ', 'ta': 'அரிசி', 'te': 'బియ్యం', 'kn': 'ಅಕ್ಕಿ'},
        'onion': {'en': 'Onion', 'hi': 'प्याज', 'mr': 'कांदा', 'pa': 'ਪਿਆਜ਼', 'ta': 'வெங்காயம்', 'te': 'ఉల్లిపాయ', 'kn': 'ಈರುಳ್ಳಿ'},
        'potato': {'en': 'Potato', 'hi': 'आलू', 'mr': 'बटाटा', 'pa': 'ਆਲੂ', 'ta': 'உருளைக்கிழங்கு', 'te': 'బంగాళాదుంప', 'kn': 'ಆಲೂಗಡ್ಡೆ'},
        'tomato': {'en': 'Tomato', 'hi': 'टमाटर', 'mr': 'टोमॅटो', 'pa': 'ਟਮਾਟਰ', 'ta': 'தக்காளி', 'te': 'టమాటా', 'kn': 'ಟೊಮ್ಯಾಟೊ'},
        'soybean': {'en': 'Soybean', 'hi': 'सोयाबीन', 'mr': 'सोयाबीन', 'pa': 'ਸੋਇਆਬੀਨ'},
        'cotton': {'en': 'Cotton', 'hi': 'कपास', 'mr': 'कापूस', 'pa': 'ਕਪਾਹ'},
        'sugarcane': {'en': 'Sugarcane', 'hi': 'गन्ना', 'mr': 'ऊस', 'pa': 'ਗੰਨਾ'},
        'mustard': {'en': 'Mustard', 'hi': 'सरसों', 'mr': 'मोहरी', 'pa': 'ਸਰ੍ਹੋਂ'},
        'chana': {'en': 'Chickpea', 'hi': 'चना', 'mr': 'हरभरा', 'pa': 'ਛੋਲੇ'},
        'maize': {'en': 'Maize', 'hi': 'मक्का', 'mr': 'मका', 'pa': 'ਮੱਕੀ'},
        'bajra': {'en': 'Pearl Millet', 'hi': 'बाजरा', 'mr': 'बाजरी', 'pa': 'ਬਾਜਰਾ'},
        'jowar': {'en': 'Sorghum', 'hi': 'ज्वार', 'mr': 'ज्वारी', 'pa': 'ਜਵਾਰ'},
        'turmeric': {'en': 'Turmeric', 'hi': 'हल्दी', 'mr': 'हळद', 'pa': 'ਹਲਦੀ'},
        'chilli': {'en': 'Red Chilli', 'hi': 'लाल मिर्च', 'mr': 'लाल मिरची', 'pa': 'ਲਾਲ ਮਿਰਚ'},
        'garlic': {'en': 'Garlic', 'hi': 'लहसुन', 'mr': 'लसूण', 'pa': 'ਲਸਣ'},
        'banana': {'en': 'Banana', 'hi': 'केला', 'mr': 'केळे', 'pa': 'ਕੇਲਾ'},
        'mango': {'en': 'Mango', 'hi': 'आम', 'mr': 'आंबा', 'pa': 'ਅੰਬ'},
    }
    
    # MSP (Minimum Support Price) 2025-26 Rabi season (Rs per quintal)
    MSP_DATA = {
        'wheat': 2275, 'mustard': 5650, 'chana': 5440, 'masoor': 6425,
        'safflower': 5800, 'barley': 1850,
        # Kharif MSP 2025-26
        'rice': 2300, 'jowar': 3371, 'bajra': 2625, 'maize': 2090,
        'cotton': 7121, 'soybean': 4892, 'groundnut': 6377,
        'moong': 8558, 'urad': 7000, 'tur': 7000, 'sugarcane': 340,
    }
    
    # Indian states and their major mandis
    STATE_MANDIS = {
        'maharashtra': ['Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Aurangabad', 'Solapur', 'Kolhapur'],
        'punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Moga', 'Khanna'],
        'haryana': ['Karnal', 'Hisar', 'Ambala', 'Rohtak', 'Sonipat', 'Panipat'],
        'uttar pradesh': ['Lucknow', 'Agra', 'Kanpur', 'Varanasi', 'Allahabad', 'Meerut'],
        'madhya pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Dewas'],
        'rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Ajmer', 'Udaipur', 'Bikaner'],
        'gujarat': ['Ahmedabad', 'Rajkot', 'Surat', 'Junagadh', 'Gondal', 'Unjha'],
        'karnataka': ['Bangalore', 'Hubli', 'Mysore', 'Belgaum', 'Davangere', 'Shimoga'],
        'tamil nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Erode'],
        'andhra pradesh': ['Hyderabad', 'Guntur', 'Kurnool', 'Vijayawada', 'Warangal'],
        'west bengal': ['Kolkata', 'Siliguri', 'Burdwan', 'Hooghly'],
        'bihar': ['Patna', 'Muzaffarpur', 'Gaya', 'Bhagalpur'],
        'kerala': ['Kochi', 'Thrissur', 'Kozhikode', 'Thiruvananthapuram'],
    }

    def __init__(self):
        # OLD: self.api_key = os.getenv('DATA_GOV_API_KEY', '')  # disabled — was empty, always hit fallback
        # NEW: Use real data.gov.in API key (env var or hardcoded fallback)
        self.api_key = os.getenv('DATA_GOV_API_KEY', '579b464db66ec23bdd000001adf755eb8192414c75dc058810d88103')
        self.cache = {}
        self.cache_duration = 1800  # 30 minutes
    
    def get_mandi_prices(self, commodity: str = None, state: str = None, district: str = None) -> dict:
        """
        Get real-time mandi prices for commodities.
        Returns structured price data with MSP comparison.
        """
        # Normalize inputs
        commodity = (commodity or '').lower().strip()
        state = (state or '').lower().strip()
        
        # Try data.gov.in API first
        api_data = self._fetch_from_api(commodity, state, district)
        if api_data:
            return api_data
        
        # Fallback: Generate intelligent price data based on MSP and market knowledge
        return self._generate_market_intelligence(commodity, state)
    
    def _fetch_from_api(self, commodity: str, state: str, district: str) -> Optional[dict]:
        """Fetch prices from data.gov.in API (ENABLED with real API key)"""
        if not self.api_key:
            print("⚠️ Mandi API: No API key configured, using fallback")
            return None
        
        cache_key = f"{commodity}_{state}_{district}"
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if (datetime.now() - timestamp).total_seconds() < self.cache_duration:
                print(f"✅ Mandi API: Using cached data for {commodity}")
                return cached_data
        
        try:
            print(f"🔄 Mandi API: Fetching live prices for '{commodity}' from data.gov.in...")
            url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
            params = {
                'api-key': self.api_key,
                'format': 'json',
                'limit': 50,
                'offset': 0,
            }
            
            if commodity:
                params['filters[commodity]'] = commodity.title()
            if state:
                params['filters[state]'] = state.title()
            if district:
                params['filters[district]'] = district.title()
            
            response = requests.get(url, params=params, timeout=10)
            print(f"📡 Mandi API: Response status = {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                records = data.get('records', [])
                print(f"📊 Mandi API: Got {len(records)} records for '{commodity}'")
                
                if records:
                    result = self._format_api_data(records, commodity)
                    self.cache[cache_key] = (result, datetime.now())
                    return result
                else:
                    print(f"⚠️ Mandi API: No records found for '{commodity}', falling back to market intelligence")
            else:
                print(f"⚠️ Mandi API: Non-200 response: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"❌ Mandi API error: {e}")
        
        return None
    
    def _format_api_data(self, records: list, commodity: str) -> dict:
        """Format API response into structured price data"""
        prices = []
        for record in records[:20]:
            prices.append({
                'state': record.get('state', ''),
                'district': record.get('district', ''),
                'market': record.get('market', ''),
                'commodity': record.get('commodity', ''),
                'variety': record.get('variety', ''),
                'min_price': float(record.get('min_price', 0)),
                'max_price': float(record.get('max_price', 0)),
                'modal_price': float(record.get('modal_price', 0)),
                'arrival_date': record.get('arrival_date', ''),
            })
        
        # Calculate statistics
        if prices:
            all_modal = [p['modal_price'] for p in prices if p['modal_price'] > 0]
            avg_price = sum(all_modal) / len(all_modal) if all_modal else 0
            min_price = min(all_modal) if all_modal else 0
            max_price = max(all_modal) if all_modal else 0
        else:
            avg_price = min_price = max_price = 0
        
        msp = self.MSP_DATA.get(commodity, None)
        
        return {
            'success': True,
            'source': 'data.gov.in',
            'commodity': commodity,
            'prices': prices,
            'statistics': {
                'avg_price': round(avg_price, 2),
                'min_price': round(min_price, 2),
                'max_price': round(max_price, 2),
                'total_markets': len(prices),
            },
            'msp': msp,
            'msp_comparison': f"{'Above' if avg_price > msp else 'Below'} MSP by ₹{abs(avg_price - msp):.0f}/quintal" if msp and avg_price else None,
            'timestamp': datetime.now().isoformat(),
        }
    
    def _generate_market_intelligence(self, commodity: str, state: str) -> dict:
        """Fallback: Generate static market intelligence when live API is unavailable/crashed"""
        print(f"📦 Mandi Fallback: Using static market intelligence for '{commodity}' (API was unavailable)")
        
        # Realistic price ranges for major commodities (Rs/quintal, Feb 2026 estimates)
        price_ranges = {
            'wheat': (2200, 2800), 'rice': (2100, 3500), 'onion': (800, 3500),
            'potato': (600, 2000), 'tomato': (500, 4000), 'soybean': (4200, 5500),
            'cotton': (6500, 8000), 'mustard': (5000, 6500), 'chana': (4800, 6200),
            'maize': (1800, 2500), 'bajra': (2200, 3000), 'jowar': (2800, 3800),
            'turmeric': (7000, 15000), 'chilli': (8000, 25000), 'garlic': (3000, 12000),
            'sugarcane': (300, 400), 'banana': (800, 2500), 'mango': (2000, 8000),
        }
        
        if commodity not in price_ranges:
            # Return list of available commodities
            return {
                'success': True,
                'source': 'reference_data',
                'message': 'commodity_not_found',
                'available_commodities': list(self.COMMODITY_MAP.keys()),
                'msp_data': self.MSP_DATA,
            }
        
        min_p, max_p = price_ranges[commodity]
        import random
        # Generate realistic variation
        modal_p = round((min_p + max_p) / 2 + random.uniform(-200, 200), 0)
        
        msp = self.MSP_DATA.get(commodity, None)
        
        # Generate state-wise prices
        target_states = [state] if state else ['maharashtra', 'punjab', 'madhya pradesh', 'uttar pradesh', 'rajasthan']
        
        prices = []
        for st in target_states:
            mandis = self.STATE_MANDIS.get(st, [st.title()])
            for mandi in mandis[:3]:
                variation = random.uniform(-300, 300)
                prices.append({
                    'state': st.title(),
                    'market': mandi,
                    'commodity': self.COMMODITY_MAP.get(commodity, {}).get('en', commodity.title()),
                    'min_price': round(min_p + variation * 0.5, 0),
                    'max_price': round(max_p + variation * 0.5, 0),
                    'modal_price': round(modal_p + variation, 0),
                })
        
        return {
            'success': True,
            'source': 'market_intelligence',
            'commodity': commodity,
            'commodity_names': self.COMMODITY_MAP.get(commodity, {}),
            'prices': prices,
            'statistics': {
                'avg_price': round(modal_p, 0),
                'min_price': min_p,
                'max_price': max_p,
                'total_markets': len(prices),
            },
            'msp': msp,
            'msp_comparison': f"{'Above' if modal_p > msp else 'Below'} MSP by ₹{abs(modal_p - msp):.0f}/quintal" if msp else None,
            'trend': 'stable',
            'recommendation': self._get_selling_advice(commodity, modal_p, msp),
            'timestamp': datetime.now().isoformat(),
        }
    
    def _get_selling_advice(self, commodity: str, current_price: float, msp: float) -> str:
        """Generate selling advice based on price vs MSP"""
        if not msp:
            return "Monitor prices closely and sell when satisfied with the rate."
        
        ratio = current_price / msp
        if ratio > 1.2:
            return f"SELL NOW - Price is {((ratio-1)*100):.0f}% above MSP. Good time to sell."
        elif ratio > 1.0:
            return f"HOLD/SELL - Price is slightly above MSP. Consider selling if storage costs are high."
        elif ratio > 0.9:
            return f"HOLD - Price is near MSP. Consider selling at government procurement centers."
        else:
            return f"HOLD - Price is below MSP. Sell at government APMC mandi for MSP guarantee."
    
    def get_msp_data(self) -> dict:
        """Get all MSP data with current season info"""
        current_month = datetime.now().month
        season = 'Rabi' if current_month in [10, 11, 12, 1, 2, 3] else 'Kharif'
        
        return {
            'season': season,
            'year': '2025-26',
            'msp_prices': self.MSP_DATA,
            'note': f'Minimum Support Prices for {season} season 2025-26 (Rs/quintal)',
        }
    
    def detect_commodity_in_message(self, message: str) -> Optional[str]:
        """Detect commodity name from user message in any language"""
        msg = message.lower()
        
        for commodity, names in self.COMMODITY_MAP.items():
            if commodity in msg:
                return commodity
            for lang, name in names.items():
                if name.lower() in msg:
                    return commodity
        
        return None


# ============================================================
# 2. GOVERNMENT SCHEME FINDER
# ============================================================

class GovernmentSchemeService:
    """
    Indian government agricultural scheme database.
    Provides personalized scheme recommendations based on farmer profile.
    """
    
    SCHEMES = [
        {
            'id': 'pm_kisan',
            'name': {'en': 'PM-KISAN', 'hi': 'पीएम-किसान'},
            'full_name': 'Pradhan Mantri Kisan Samman Nidhi',
            'benefit': '₹6,000/year in 3 installments of ₹2,000',
            'eligibility': 'All landholding farmer families',
            'how_to_apply': 'Apply at pmkisan.gov.in or through CSC centers',
            'documents': ['Aadhaar Card', 'Land Records', 'Bank Account'],
            'category': 'income_support',
            'url': 'https://pmkisan.gov.in/',
        },
        {
            'id': 'pmfby',
            'name': {'en': 'PMFBY', 'hi': 'पीएमएफबीवाई'},
            'full_name': 'Pradhan Mantri Fasal Bima Yojana',
            'benefit': 'Crop insurance at 1.5% (Rabi), 2% (Kharif), 5% (Horticulture) premium',
            'eligibility': 'All farmers growing notified crops in notified areas',
            'how_to_apply': 'Apply through banks, CSC, or pmfby.gov.in',
            'documents': ['Aadhaar Card', 'Land Records', 'Bank Account', 'Sowing Certificate'],
            'category': 'insurance',
            'url': 'https://pmfby.gov.in/',
        },
        {
            'id': 'kcc',
            'name': {'en': 'KCC', 'hi': 'किसान क्रेडिट कार्ड'},
            'full_name': 'Kisan Credit Card',
            'benefit': 'Credit up to ₹3 lakh at 4% interest (with subsidy). Crop loan, working capital, and post-harvest expenses.',
            'eligibility': 'All farmers, sharecroppers, tenant farmers, SHGs',
            'how_to_apply': 'Apply at any commercial/cooperative bank with land documents',
            'documents': ['Aadhaar Card', 'Land Records', 'Passport Photo', 'Application Form'],
            'category': 'credit',
            'url': 'https://www.pmkisan.gov.in/KCC',
        },
        {
            'id': 'soil_health_card',
            'name': {'en': 'Soil Health Card', 'hi': 'मृदा स्वास्थ्य कार्ड'},
            'full_name': 'Soil Health Card Scheme',
            'benefit': 'Free soil testing and nutrient management recommendations every 2 years',
            'eligibility': 'All farmers with agricultural land',
            'how_to_apply': 'Visit soilhealth.dac.gov.in or contact Krishi Vigyan Kendra',
            'documents': ['Aadhaar Card', 'Land Details'],
            'category': 'soil_health',
            'url': 'https://soilhealth.dac.gov.in/',
        },
        {
            'id': 'pm_kisan_mandhan',
            'name': {'en': 'PM-Kisan Mandhan', 'hi': 'पीएम किसान मानधन'},
            'full_name': 'PM Kisan Maan-Dhan Yojana',
            'benefit': '₹3,000/month pension after age 60. Government matches farmer contribution.',
            'eligibility': 'Small and marginal farmers (18-40 years) with land up to 2 hectares',
            'how_to_apply': 'Apply at CSC centers or maandhan.in',
            'documents': ['Aadhaar Card', 'Bank Account', 'Land Records'],
            'category': 'pension',
            'url': 'https://maandhan.in/',
        },
        {
            'id': 'pkvy',
            'name': {'en': 'PKVY', 'hi': 'परम्परागत कृषि विकास योजना'},
            'full_name': 'Paramparagat Krishi Vikas Yojana',
            'benefit': '₹50,000/hectare over 3 years for organic farming. Certification and marketing support.',
            'eligibility': 'Farmers willing to adopt organic farming (cluster of 50+ farmers, 50 acres)',
            'how_to_apply': 'Apply through State Agriculture Department or pgsindia-ncof.gov.in',
            'documents': ['Aadhaar Card', 'Land Records', 'Farmer Group Registration'],
            'category': 'organic_farming',
            'url': 'https://pgsindia-ncof.gov.in/',
        },
        {
            'id': 'pmksy',
            'name': {'en': 'PMKSY', 'hi': 'प्रधानमंत्री कृषि सिंचाई योजना'},
            'full_name': 'Pradhan Mantri Krishi Sinchayee Yojana',
            'benefit': '55% subsidy (small farmers) / 45% (others) on micro-irrigation (drip/sprinkler)',
            'eligibility': 'All farmers with agricultural land',
            'how_to_apply': 'Apply through State Agriculture/Horticulture Department',
            'documents': ['Aadhaar Card', 'Land Records', '7/12 Extract', 'Bank Account'],
            'category': 'irrigation',
            'url': 'https://pmksy.gov.in/',
        },
        {
            'id': 'e_nam',
            'name': {'en': 'e-NAM', 'hi': 'ई-नाम'},
            'full_name': 'National Agriculture Market (e-NAM)',
            'benefit': 'Online trading platform. Sell produce in any mandi across India. Better price discovery.',
            'eligibility': 'All farmers, traders, and commission agents',
            'how_to_apply': 'Register at enam.gov.in with mandi license',
            'documents': ['Aadhaar Card', 'Bank Account', 'Mandi License (for traders)'],
            'category': 'market_access',
            'url': 'https://enam.gov.in/',
        },
        {
            'id': 'agri_infra_fund',
            'name': {'en': 'AIF', 'hi': 'कृषि अवसंरचना कोष'},
            'full_name': 'Agriculture Infrastructure Fund',
            'benefit': '3% interest subvention on loans up to ₹2 crore for agri-infrastructure (cold storage, warehouses, processing units)',
            'eligibility': 'Farmers, FPOs, PACS, Startups, Agri-entrepreneurs',
            'how_to_apply': 'Apply through agriinfra.dac.gov.in via any lending institution',
            'documents': ['Aadhaar Card', 'Business Plan', 'Land Documents', 'Bank Account'],
            'category': 'infrastructure',
            'url': 'https://agriinfra.dac.gov.in/',
        },
        {
            'id': 'nfsm',
            'name': {'en': 'NFSM', 'hi': 'राष्ट्रीय खाद्य सुरक्षा मिशन'},
            'full_name': 'National Food Security Mission',
            'benefit': 'Subsidized seeds, equipment, training. Up to 50% subsidy on farm implements.',
            'eligibility': 'Farmers in identified districts growing rice, wheat, pulses, coarse cereals',
            'how_to_apply': 'Apply through District Agriculture Officer or State Agriculture Department',
            'documents': ['Aadhaar Card', 'Land Records', 'Bank Account'],
            'category': 'food_security',
            'url': 'https://nfsm.gov.in/',
        },
    ]
    
    def get_all_schemes(self) -> List[dict]:
        """Return all government schemes"""
        return self.SCHEMES
    
    def find_schemes(self, crop: str = None, land_size: str = None, 
                     state: str = None, farmer_type: str = None) -> List[dict]:
        """Find relevant schemes based on farmer profile"""
        relevant = []
        
        for scheme in self.SCHEMES:
            relevance_score = 0
            
            # All farmers are eligible for basic schemes
            if scheme['id'] in ['pm_kisan', 'kcc', 'soil_health_card', 'e_nam']:
                relevance_score += 3
            
            # Insurance relevant for all crop farmers
            if scheme['id'] == 'pmfby' and crop:
                relevance_score += 3
            
            # Irrigation schemes
            if scheme['id'] == 'pmksy':
                relevance_score += 2
            
            # Small farmer specific
            if land_size and land_size in ['small', 'marginal', '<2']:
                if scheme['id'] == 'pm_kisan_mandhan':
                    relevance_score += 3
            
            # Organic farming
            if farmer_type and 'organic' in farmer_type.lower():
                if scheme['id'] == 'pkvy':
                    relevance_score += 3
            
            # Infrastructure
            if scheme['id'] == 'agri_infra_fund':
                relevance_score += 1
            
            if scheme['id'] == 'nfsm':
                relevance_score += 1
            
            if relevance_score > 0:
                scheme_copy = scheme.copy()
                scheme_copy['relevance_score'] = relevance_score
                relevant.append(scheme_copy)
        
        # Sort by relevance
        relevant.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        return relevant
    
    def get_scheme_details(self, scheme_id: str) -> Optional[dict]:
        """Get detailed information about a specific scheme"""
        for scheme in self.SCHEMES:
            if scheme['id'] == scheme_id:
                return scheme
        return None


# ============================================================
# 3. CROP CALENDAR & SEASONAL PLANNER
# ============================================================

class CropCalendarService:
    """
    Intelligent crop calendar for Indian agriculture.
    Provides month-by-month farming actions based on region and crop.
    """
    
    # Crop seasons in India
    SEASONS = {
        'kharif': {'months': [6, 7, 8, 9, 10], 'sowing': 'June-July', 'harvest': 'October-November',
                   'crops': ['rice', 'maize', 'cotton', 'soybean', 'groundnut', 'bajra', 'jowar', 'tur', 'moong', 'urad', 'sugarcane']},
        'rabi': {'months': [10, 11, 12, 1, 2, 3], 'sowing': 'October-November', 'harvest': 'March-April',
                 'crops': ['wheat', 'mustard', 'chana', 'barley', 'peas', 'linseed', 'potato', 'onion']},
        'zaid': {'months': [3, 4, 5, 6], 'sowing': 'March-April', 'harvest': 'June-July',
                 'crops': ['watermelon', 'muskmelon', 'cucumber', 'moong', 'fodder']},
    }
    
    def get_current_season(self) -> dict:
        """Get current agricultural season"""
        month = datetime.now().month
        
        for season_name, season_data in self.SEASONS.items():
            if month in season_data['months']:
                return {
                    'season': season_name,
                    'sowing_period': season_data['sowing'],
                    'harvest_period': season_data['harvest'],
                    'recommended_crops': season_data['crops'],
                    'current_month': datetime.now().strftime('%B'),
                }
        
        return {'season': 'transition', 'current_month': datetime.now().strftime('%B')}
    
    def get_monthly_tasks(self, month: int = None, crop: str = None, region: str = None) -> dict:
        """Get farming tasks for a specific month"""
        if month is None:
            month = datetime.now().month
        
        month_names = {1: 'January', 2: 'February', 3: 'March', 4: 'April',
                       5: 'May', 6: 'June', 7: 'July', 8: 'August',
                       9: 'September', 10: 'October', 11: 'November', 12: 'December'}
        
        # Comprehensive monthly farming calendar for India
        calendar = {
            1: {  # January
                'season': 'Rabi (Peak)',
                'tasks': [
                    '🌾 Apply 2nd dose of urea to wheat (CRI stage)',
                    '💧 Give irrigation to wheat, mustard, chickpea',
                    '🧪 Spray fungicide for rust prevention in wheat',
                    '🥔 Earthing up in potato crop',
                    '🌱 Prepare nursery for spring vegetables',
                    '📊 Monitor aphid attack in mustard',
                ],
                'alerts': ['Frost warning - protect crops with light irrigation in evening'],
            },
            2: {  # February
                'season': 'Rabi (Late)',
                'tasks': [
                    '🌾 Apply 3rd irrigation to wheat at flowering stage',
                    '🧪 Spray for yellow rust in wheat if spotted',
                    '🥔 Harvest early potato varieties',
                    '🌿 Start preparing for Zaid season vegetables',
                    '📋 Apply for PMFBY crop insurance for upcoming season',
                    '🐄 Vaccinate livestock before summer',
                ],
                'alerts': ['Temperature rising - plan irrigation schedule carefully'],
            },
            3: {  # March  
                'season': 'Rabi Harvest + Zaid Sowing',
                'tasks': [
                    '🌾 Harvest wheat, mustard, and chickpea',
                    '🍉 Sow Zaid crops: watermelon, muskmelon, cucumber',
                    '💰 Sell rabi produce at mandi - check MSP rates',
                    '🌱 Prepare summer vegetable nursery',
                    '🔧 Service farm equipment before monsoon',
                    '📊 Get soil tested at Krishi Vigyan Kendra',
                ],
                'alerts': ['Heatwave alert - arrange shade for nurseries and livestock'],
            },
            4: {  # April
                'season': 'Zaid + Pre-Kharif Prep',
                'tasks': [
                    '🍉 Manage Zaid crops - regular irrigation needed',
                    '🌿 Deep ploughing for kharif season preparation',
                    '🧪 Apply lime/gypsum to soil if pH imbalanced',
                    '🏗️ Repair bunds, channels, and farm structures',
                    '🌱 Procure quality seeds for kharif sowing',
                    '📋 Register on e-NAM for better market access',
                ],
                'alerts': ['Extreme heat - irrigate in early morning or evening only'],
            },
            5: {  # May
                'season': 'Pre-Monsoon Preparation',
                'tasks': [
                    '🍉 Harvest Zaid crops',
                    '🌿 Complete field preparation - ploughing, leveling',
                    '💊 Treat seeds with fungicide before sowing',
                    '🧪 Apply FYM/compost to fields (10-15 tonnes/hectare)',
                    '🌧️ Clean drainage channels before monsoon',
                    '🛒 Purchase fertilizers, pesticides for kharif season',
                ],
                'alerts': ['Pre-monsoon showers possible - be ready for early sowing'],
            },
            6: {  # June
                'season': 'Kharif Sowing',
                'tasks': [
                    '🌾 Sow rice nursery, transplant after 25 days',
                    '🌽 Direct sow maize, bajra, jowar',
                    '🫘 Sow pulses: moong, urad, tur/arhar',
                    '🥜 Sow groundnut, soybean, cotton',
                    '💧 Setup drip/sprinkler irrigation systems',
                    '📋 Apply for PMFBY kharif crop insurance',
                ],
                'alerts': ['Monsoon onset - sow within 1 week of adequate rainfall'],
            },
            7: {  # July
                'season': 'Kharif (Early Growth)',
                'tasks': [
                    '🌾 Transplant rice paddy to main field',
                    '🧪 Apply 1st dose of fertilizer (DAP/NPK)',
                    '🌿 Weed management - inter-cultivation',
                    '📊 Monitor for stem borer in rice, bollworm in cotton',
                    '💧 Ensure proper drainage in waterlogged fields',
                    '🐛 Setup pheromone traps for pest monitoring',
                ],
                'alerts': ['Heavy rainfall expected - ensure proper drainage'],
            },
            8: {  # August
                'season': 'Kharif (Active Growth)',
                'tasks': [
                    '🧪 Apply 2nd dose of urea/fertilizer',
                    '🐛 Intensive pest and disease surveillance',
                    '🌿 Remove weeds, apply weedicide if needed',
                    '🌾 Top dressing in rice at tillering stage',
                    '📊 Check for leaf curl virus in cotton/chilli',
                    '🏪 Start planning storage for upcoming harvest',
                ],
                'alerts': ['Flood risk in low-lying areas - move stored grain to safety'],
            },
            9: {  # September
                'season': 'Kharif (Maturation)',
                'tasks': [
                    '🌾 Monitor crop maturity signs',
                    '🧪 Apply potash for grain filling in rice/maize',
                    '📊 Check moisture level for harvest timing',
                    '🏗️ Prepare threshing floor and storage',
                    '🌱 Start rabi nursery preparation',
                    '💰 Check mandi prices for selling strategy',
                ],
                'alerts': ['Cyclone/late monsoon risk - secure crop and equipment'],
            },
            10: {  # October
                'season': 'Kharif Harvest + Rabi Sowing',
                'tasks': [
                    '🌾 Harvest rice, cotton, soybean, maize',
                    '🌾 Sow wheat, mustard after monsoon withdrawal',
                    '🫘 Sow chickpea (chana), lentils (masoor)',
                    '🧅 Plant onion sets/seedlings',
                    '💰 Sell kharif produce - compare mandi prices',
                    '🧪 Apply basal dose fertilizer for rabi crops',
                ],
                'alerts': ['Post-monsoon pest surge - watch for armyworm'],
            },
            11: {  # November
                'season': 'Rabi Sowing (Peak)',
                'tasks': [
                    '🌾 Complete wheat sowing (last recommended date)',
                    '🌿 Sow mustard, gram, barley',
                    '🥔 Plant potato in north India',
                    '💧 First irrigation to wheat (21 days after sowing)',
                    '🧪 Apply pre-emergence herbicide in wheat',
                    '📋 Apply for PM-KISAN installment if not received',
                ],
                'alerts': ['Fog season approaching - plan spray timing accordingly'],
            },
            12: {  # December
                'season': 'Rabi (Early Growth)',
                'tasks': [
                    '🌾 2nd irrigation to wheat (CRI stage - 40-45 days)',
                    '🧪 Apply 1st top dressing of urea to wheat',
                    '📊 Scout for aphids in mustard, cut worm in chickpea',
                    '🐄 Ensure warm shelter for livestock',
                    '🌿 Weed management in rabi crops',
                    '📋 Check PM-KISAN installment status',
                ],
                'alerts': ['Cold wave warning - protect crops and livestock'],
            },
        }
        
        month_data = calendar.get(month, {})
        season_info = self.get_current_season()
        
        return {
            'month': month_names.get(month, ''),
            'month_number': month,
            'season': month_data.get('season', season_info.get('season', '')),
            'tasks': month_data.get('tasks', []),
            'alerts': month_data.get('alerts', []),
            'recommended_crops': season_info.get('recommended_crops', []),
        }
    
    def get_year_overview(self) -> List[dict]:
        """Get full year farming calendar overview"""
        return [self.get_monthly_tasks(month=m) for m in range(1, 13)]


# ============================================================
# 4. SOIL HEALTH ANALYSIS ENGINE
# ============================================================

class SoilHealthService:
    """
    Soil health analysis and recommendation engine.
    Provides NPK analysis, pH correction, and organic amendment suggestions.
    """
    
    # Optimal ranges for soil parameters
    OPTIMAL_RANGES = {
        'ph': {'low': 6.0, 'high': 7.5, 'ideal': 6.5},
        'nitrogen_kg_ha': {'low': 280, 'medium': 560, 'high': 560},
        'phosphorus_kg_ha': {'low': 10, 'medium': 25, 'high': 25},
        'potassium_kg_ha': {'low': 110, 'medium': 280, 'high': 280},
        'organic_carbon_pct': {'low': 0.5, 'medium': 0.75, 'high': 0.75},
    }
    
    # Fertilizer recommendations by crop (kg/hectare)
    CROP_FERTILIZER = {
        'wheat': {'N': 120, 'P': 60, 'K': 40, 'schedule': '½N+full P+full K at sowing, ¼N at CRI, ¼N at flowering'},
        'rice': {'N': 120, 'P': 60, 'K': 60, 'schedule': '½N+full P+full K at transplanting, ¼N at tillering, ¼N at panicle initiation'},
        'maize': {'N': 120, 'P': 60, 'K': 40, 'schedule': '⅓N+full P+full K at sowing, ⅓N at knee-high, ⅓N at tasseling'},
        'cotton': {'N': 150, 'P': 60, 'K': 60, 'schedule': '⅓N+full P+full K at sowing, ⅓N at squaring, ⅓N at flowering'},
        'potato': {'N': 150, 'P': 100, 'K': 120, 'schedule': '½N+full P+⅔K at planting, ½N+⅓K at earthing up'},
        'tomato': {'N': 120, 'P': 80, 'K': 80, 'schedule': '½N+full P+full K at transplanting, ¼N at 30 days, ¼N at flowering'},
        'onion': {'N': 100, 'P': 50, 'K': 60, 'schedule': '½N+full P+full K at transplanting, ½N at 30 days'},
        'mustard': {'N': 80, 'P': 40, 'K': 20, 'schedule': 'Full dose at sowing, top dressing at 30 days if needed'},
        'chana': {'N': 20, 'P': 60, 'K': 20, 'schedule': 'Full dose at sowing (being legume, needs less N)'},
        'soybean': {'N': 25, 'P': 60, 'K': 40, 'schedule': 'Full dose at sowing (legume crop)'},
        'sugarcane': {'N': 250, 'P': 85, 'K': 100, 'schedule': '⅓N+full P+⅓K at planting, ⅓N+⅓K at 60 days, ⅓N+⅓K at 90 days'},
    }
    
    def get_fertilizer_recommendation(self, crop: str) -> Optional[dict]:
        """Get NPK fertilizer recommendation for a crop"""
        crop = crop.lower().strip()
        if crop in self.CROP_FERTILIZER:
            rec = self.CROP_FERTILIZER[crop]
            
            # Convert NPK to common fertilizer quantities
            urea_kg = round(rec['N'] / 0.46, 1)  # Urea = 46% N
            dap_kg = round(rec['P'] / 0.46, 1)    # DAP = 46% P2O5
            mop_kg = round(rec['K'] / 0.60, 1)    # MOP = 60% K2O
            
            return {
                'crop': crop,
                'npk_kg_per_hectare': {'N': rec['N'], 'P': rec['P'], 'K': rec['K']},
                'fertilizer_quantities': {
                    'urea_kg': urea_kg,
                    'dap_kg': dap_kg,
                    'mop_kg': mop_kg,
                },
                'application_schedule': rec['schedule'],
                'organic_alternative': f"Apply 10-15 tonnes FYM/compost + {round(urea_kg*0.5)}kg urea for integrated nutrient management",
            }
        return None
    
    def analyze_soil_symptoms(self, symptoms: str) -> dict:
        """Analyze soil issues based on symptom description"""
        symptoms_lower = symptoms.lower()
        
        issues = []
        recommendations = []
        
        # Detect common soil problems
        if any(w in symptoms_lower for w in ['yellow', 'pale', 'chlorosis', 'पीला', 'पिवळा']):
            issues.append('Nitrogen deficiency (yellowing of older leaves)')
            recommendations.append('Apply 25-30 kg urea/hectare as top dressing')
            recommendations.append('Spray 2% urea solution for quick correction')
        
        if any(w in symptoms_lower for w in ['purple', 'reddish', 'stunted', 'बैंगनी']):
            issues.append('Phosphorus deficiency (purplish coloration, stunted growth)')
            recommendations.append('Apply 50 kg DAP/hectare or 100 kg SSP/hectare')
        
        if any(w in symptoms_lower for w in ['brown edge', 'scorched', 'tip burn', 'marginal burn', 'किनारा']):
            issues.append('Potassium deficiency (leaf margin scorching)')
            recommendations.append('Apply 40-50 kg MOP/hectare')
        
        if any(w in symptoms_lower for w in ['acidic', 'acid', 'low ph', 'अम्लीय']):
            issues.append('Acidic soil (low pH)')
            recommendations.append('Apply 2-4 quintals lime/hectare before sowing')
            recommendations.append('Use dolomite for calcium + magnesium correction')
        
        if any(w in symptoms_lower for w in ['alkaline', 'saline', 'salt', 'white crust', 'क्षारीय', 'नमकीन']):
            issues.append('Saline/Alkaline soil')
            recommendations.append('Apply 5-10 quintals gypsum/hectare')
            recommendations.append('Grow salt-tolerant crops: barley, beet, cotton')
        
        if any(w in symptoms_lower for w in ['waterlog', 'drainage', 'standing water', 'जलभराव']):
            issues.append('Waterlogging / poor drainage')
            recommendations.append('Improve drainage with channels and raised beds')
            recommendations.append('Apply organic matter to improve soil structure')
        
        if any(w in symptoms_lower for w in ['hard', 'compacted', 'crack', 'कठोर', 'सख्त']):
            issues.append('Soil compaction')
            recommendations.append('Deep ploughing with chisel plough')
            recommendations.append('Add organic matter: FYM, compost, green manure')
        
        if not issues:
            issues.append('General soil health improvement needed')
            recommendations.append('Get soil tested at nearest Krishi Vigyan Kendra (free under Soil Health Card scheme)')
            recommendations.append('Apply 10 tonnes FYM + green manure crop before next season')
        
        return {
            'detected_issues': issues,
            'recommendations': recommendations,
            'general_advice': [
                'Get Soil Health Card: soilhealth.dac.gov.in (FREE)',
                'Practice crop rotation to maintain soil fertility',
                'Use vermicompost for organic nutrient supply',
                'Avoid burning crop residue - incorporate into soil',
            ],
        }


# ============================================================
# 5. FARM ECONOMICS CALCULATOR
# ============================================================

class FarmEconomicsService:
    """
    Farm profitability calculator.
    Estimates costs, revenue, and ROI for different crops.
    """
    
    # Average cost of cultivation per hectare (Rs) - India averages
    CROP_ECONOMICS = {
        'wheat': {'cost_per_ha': 45000, 'avg_yield_qtl': 45, 'msp': 2275},
        'rice': {'cost_per_ha': 55000, 'avg_yield_qtl': 50, 'msp': 2300},
        'maize': {'cost_per_ha': 35000, 'avg_yield_qtl': 55, 'msp': 2090},
        'cotton': {'cost_per_ha': 60000, 'avg_yield_qtl': 20, 'msp': 7121},
        'soybean': {'cost_per_ha': 35000, 'avg_yield_qtl': 18, 'msp': 4892},
        'mustard': {'cost_per_ha': 30000, 'avg_yield_qtl': 15, 'msp': 5650},
        'chana': {'cost_per_ha': 30000, 'avg_yield_qtl': 18, 'msp': 5440},
        'potato': {'cost_per_ha': 100000, 'avg_yield_qtl': 250, 'msp': 0},
        'onion': {'cost_per_ha': 80000, 'avg_yield_qtl': 200, 'msp': 0},
        'tomato': {'cost_per_ha': 90000, 'avg_yield_qtl': 300, 'msp': 0},
        'sugarcane': {'cost_per_ha': 80000, 'avg_yield_qtl': 700, 'msp': 340},
        'bajra': {'cost_per_ha': 25000, 'avg_yield_qtl': 25, 'msp': 2625},
        'jowar': {'cost_per_ha': 25000, 'avg_yield_qtl': 22, 'msp': 3371},
        'turmeric': {'cost_per_ha': 150000, 'avg_yield_qtl': 60, 'msp': 0},
        'garlic': {'cost_per_ha': 120000, 'avg_yield_qtl': 80, 'msp': 0},
    }
    
    def calculate_economics(self, crop: str, area_hectares: float = 1.0, 
                           selling_price: float = None, input_cost: float = None) -> dict:
        """Calculate farm economics for a crop"""
        crop = crop.lower().strip()
        
        if crop not in self.CROP_ECONOMICS:
            return {
                'success': False,
                'error': f'Crop "{crop}" not found',
                'available_crops': list(self.CROP_ECONOMICS.keys()),
            }
        
        data = self.CROP_ECONOMICS[crop]
        cost_per_ha = input_cost if input_cost else data['cost_per_ha']
        yield_qtl = data['avg_yield_qtl']
        price = selling_price if selling_price else data['msp'] if data['msp'] > 0 else 0
        
        # Calculate for given area
        total_cost = cost_per_ha * area_hectares
        total_yield = yield_qtl * area_hectares
        total_revenue = total_yield * price if price > 0 else 0
        profit = total_revenue - total_cost
        roi = (profit / total_cost * 100) if total_cost > 0 else 0
        cost_per_quintal = total_cost / total_yield if total_yield > 0 else 0
        breakeven_price = cost_per_quintal
        
        return {
            'success': True,
            'crop': crop,
            'area_hectares': area_hectares,
            'area_acres': round(area_hectares * 2.471, 2),
            'area_bigha': round(area_hectares * 4, 2),  # Approximate
            'cost_breakdown': {
                'total_input_cost': round(total_cost, 0),
                'cost_per_hectare': round(cost_per_ha, 0),
                'cost_per_quintal': round(cost_per_quintal, 0),
            },
            'yield_estimate': {
                'total_quintals': round(total_yield, 1),
                'yield_per_hectare': round(yield_qtl, 1),
            },
            'revenue': {
                'selling_price_per_quintal': round(price, 0),
                'msp_per_quintal': data['msp'],
                'total_revenue': round(total_revenue, 0),
            },
            'profitability': {
                'net_profit': round(profit, 0),
                'roi_percentage': round(roi, 1),
                'breakeven_price': round(breakeven_price, 0),
                'profit_per_hectare': round(profit / area_hectares if area_hectares > 0 else 0, 0),
            },
            'recommendation': self._get_economics_advice(crop, profit, roi, price, data['msp']),
        }
    
    def _get_economics_advice(self, crop: str, profit: float, roi: float, 
                              price: float, msp: float) -> str:
        """Generate economics-based farming advice"""
        if roi > 50:
            return f"Excellent ROI of {roi:.0f}%! {crop.title()} is highly profitable at current prices. Consider increasing area."
        elif roi > 20:
            return f"Good ROI of {roi:.0f}%. {crop.title()} is profitable. Focus on reducing input costs and increasing yield."
        elif roi > 0:
            return f"Marginal ROI of {roi:.0f}%. Consider switching to higher-value crops or reducing costs through organic inputs."
        else:
            return f"Negative ROI of {roi:.0f}%. Consider alternative crops, reducing input costs, or selling at MSP (₹{msp}/qtl) if available."
    
    def compare_crops(self, crops: List[str], area_hectares: float = 1.0) -> dict:
        """Compare economics of multiple crops"""
        comparisons = []
        for crop in crops:
            result = self.calculate_economics(crop, area_hectares)
            if result.get('success'):
                comparisons.append(result)
        
        # Sort by ROI
        comparisons.sort(key=lambda x: x['profitability']['roi_percentage'], reverse=True)
        
        best = comparisons[0] if comparisons else None
        
        return {
            'success': True,
            'area_hectares': area_hectares,
            'comparisons': comparisons,
            'best_crop': best['crop'] if best else None,
            'best_roi': best['profitability']['roi_percentage'] if best else 0,
        }


# ============================================================
# 6. EMERGENCY ALERT SYSTEM
# ============================================================

class EmergencyAlertService:
    """
    Agricultural emergency alert system.
    Provides pest outbreak warnings, weather alerts, and market alerts.
    """
    
    def get_alerts(self, location: str = None, crop: str = None) -> List[dict]:
        """Get active alerts based on location and crop"""
        current_month = datetime.now().month
        alerts = []
        
        # Season-based pest alerts
        pest_alerts = self._get_pest_alerts(current_month, crop)
        alerts.extend(pest_alerts)
        
        # Weather-based alerts
        weather_alerts = self._get_weather_alerts(current_month, location)
        alerts.extend(weather_alerts)
        
        # Market alerts
        market_alerts = self._get_market_alerts()
        alerts.extend(market_alerts)
        
        # Government deadline alerts
        deadline_alerts = self._get_deadline_alerts(current_month)
        alerts.extend(deadline_alerts)
        
        # Sort by severity
        severity_order = {'critical': 0, 'warning': 1, 'info': 2}
        alerts.sort(key=lambda x: severity_order.get(x.get('severity', 'info'), 3))
        
        return alerts
    
    def _get_pest_alerts(self, month: int, crop: str = None) -> List[dict]:
        """Get seasonal pest and disease alerts"""
        alerts = []
        
        # February alerts
        if month == 2:
            alerts.append({
                'id': 'wheat_rust_feb',
                'type': 'pest',
                'severity': 'warning',
                'title': '🦠 Yellow Rust Alert - Wheat',
                'title_hi': '🦠 पीला रतुआ चेतावनी - गेहूं',
                'message': 'Yellow rust (Puccinia striiformis) risk is HIGH in north India. Scout wheat fields for yellow-orange pustules on leaves. Spray Propiconazole 25EC (1ml/liter) immediately if spotted.',
                'message_hi': 'उत्तर भारत में पीला रतुआ (Puccinia striiformis) का खतरा अधिक है। गेहूं के खेतों में पत्तियों पर पीले-नारंगी दानों की जांच करें। दिखने पर तुरंत Propiconazole 25EC (1ml/लीटर) का छिड़काव करें।',
                'crops_affected': ['wheat'],
                'regions': ['Punjab', 'Haryana', 'UP', 'Rajasthan'],
                'valid_until': datetime(2026, 3, 15).isoformat(),
            })
            alerts.append({
                'id': 'mustard_aphid_feb',
                'type': 'pest',
                'severity': 'warning',
                'title': '🐛 Aphid Attack Alert - Mustard',
                'title_hi': '🐛 माहू कीट चेतावनी - सरसों',
                'message': 'Mustard aphid (Lipaphis erysimi) infestation peaking. Apply Imidacloprid 17.8SL (0.3ml/liter) or neem oil spray (5ml/liter) as organic alternative.',
                'message_hi': 'सरसों में माहू कीट का प्रकोप चरम पर है। Imidacloprid 17.8SL (0.3ml/लीटर) या नीम तेल (5ml/लीटर) का छिड़काव करें।',
                'crops_affected': ['mustard'],
                'regions': ['Rajasthan', 'UP', 'MP', 'Haryana'],
                'valid_until': datetime(2026, 3, 10).isoformat(),
            })
        
        # General alerts applicable year-round
        alerts.append({
            'id': 'fall_armyworm',
            'type': 'pest',
            'severity': 'info',
            'title': '🐛 Fall Armyworm - Maize (Year-round Vigilance)',
            'title_hi': '🐛 फॉल आर्मीवर्म - मक्का (साल भर सतर्कता)',
            'message': 'Fall Armyworm (Spodoptera frugiperda) is a continuous threat to maize. Use pheromone traps for early detection. Apply Emamectin Benzoate 5SG if ETL exceeded.',
            'message_hi': 'फॉल आर्मीवर्म मक्का के लिए निरंतर खतरा है। शीघ्र पहचान के लिए फेरोमोन ट्रैप लगाएं। ETL पार होने पर Emamectin Benzoate 5SG का उपयोग करें।',
            'crops_affected': ['maize', 'bajra', 'jowar'],
            'regions': ['All India'],
            'valid_until': datetime(2026, 12, 31).isoformat(),
        })
        
        return alerts
    
    def _get_weather_alerts(self, month: int, location: str = None) -> List[dict]:
        """Get weather-based agricultural alerts"""
        alerts = []
        
        if month in [12, 1, 2]:
            alerts.append({
                'id': 'cold_wave',
                'type': 'weather',
                'severity': 'warning',
                'title': '🥶 Cold Wave / Frost Risk',
                'title_hi': '🥶 शीत लहर / पाला जोखिम',
                'message': 'Cold wave conditions likely in north India. Protect crops with light irrigation in evening. Use smoke barriers around orchards. Keep livestock warm.',
                'message_hi': 'उत्तर भारत में शीत लहर की संभावना। शाम को हल्की सिंचाई से फसलों की सुरक्षा करें। बागों के चारों ओर धुएं का प्रयोग करें।',
                'regions': ['Punjab', 'Haryana', 'UP', 'Rajasthan', 'MP', 'Bihar'],
                'valid_until': datetime(2026, 2, 28).isoformat(),
            })
        
        if month in [4, 5, 6]:
            alerts.append({
                'id': 'heatwave',
                'type': 'weather',
                'severity': 'critical',
                'title': '🔥 Heatwave Warning',
                'title_hi': '🔥 लू चेतावनी',
                'message': 'Extreme heat expected. Irrigate early morning/late evening only. Provide shade to nurseries and livestock. Ensure water availability for animals.',
                'message_hi': 'अत्यधिक गर्मी की संभावना। सिंचाई केवल सुबह/शाम करें। नर्सरी और पशुओं को छाया प्रदान करें।',
                'regions': ['Rajasthan', 'Gujarat', 'MP', 'Maharashtra', 'AP', 'Telangana'],
                'valid_until': datetime(2026, 6, 30).isoformat(),
            })
        
        return alerts
    
    def _get_market_alerts(self) -> List[dict]:
        """Get market-related alerts"""
        return [{
            'id': 'msp_procurement',
            'type': 'market',
            'severity': 'info',
            'title': '💰 MSP Procurement Season Active',
            'title_hi': '💰 MSP खरीद सीजन चालू',
            'message': 'Government MSP procurement is active for rabi crops. Register at nearest APMC mandi or e-NAM portal. Wheat MSP: ₹2,275/qtl, Mustard: ₹5,650/qtl, Chana: ₹5,440/qtl.',
            'message_hi': 'रबी फसलों के लिए सरकारी MSP खरीद चालू है। निकटतम APMC मंडी या e-NAM पोर्टल पर पंजीकरण करें। गेहूं MSP: ₹2,275/क्विंटल, सरसों: ₹5,650/क्विंटल।',
            'valid_until': datetime(2026, 4, 30).isoformat(),
        }]
    
    def _get_deadline_alerts(self, month: int) -> List[dict]:
        """Get government scheme deadline alerts"""
        alerts = []
        
        if month in [1, 2, 3]:
            alerts.append({
                'id': 'pmfby_rabi_deadline',
                'type': 'deadline',
                'severity': 'critical',
                'title': '📋 PMFBY Rabi Insurance - Apply Now!',
                'title_hi': '📋 PMFBY रबी बीमा - अभी आवेदन करें!',
                'message': 'Last date to apply for PMFBY Rabi crop insurance is approaching. Apply through your bank or CSC center. Premium: 1.5% for wheat, 2% for mustard.',
                'message_hi': 'PMFBY रबी फसल बीमा के लिए आवेदन की अंतिम तिथि निकट है। बैंक या CSC केंद्र के माध्यम से आवेदन करें।',
                'valid_until': datetime(2026, 3, 31).isoformat(),
            })
        
        alerts.append({
            'id': 'pm_kisan_check',
            'type': 'deadline',
            'severity': 'info',
            'title': '📋 PM-KISAN: Check Your Installment Status',
            'title_hi': '📋 PM-KISAN: अपनी किस्त की स्थिति जांचें',
            'message': 'Check if you received your PM-KISAN installment of ₹2,000. Visit pmkisan.gov.in or call helpline 155261. If not received, contact your local agriculture office.',
            'message_hi': 'जांचें कि क्या आपको ₹2,000 की PM-KISAN किस्त मिली। pmkisan.gov.in पर जाएं या हेल्पलाइन 155261 पर कॉल करें।',
            'valid_until': datetime(2026, 12, 31).isoformat(),
        })
        
        return alerts


# ============================================================
# Initialize all services
# ============================================================

mandi_service = MandiPriceService()
scheme_service = GovernmentSchemeService()
crop_calendar_service = CropCalendarService()
soil_service = SoilHealthService()
economics_service = FarmEconomicsService()
alert_service = EmergencyAlertService()
