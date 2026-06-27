import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Switch, Spin, Tooltip, message, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import ResponsiveModal from './ResponsiveModal';
import './ResponsiveModal.css';
import './WarehouseForm.css';
import { clearErrors } from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import { deriveZone } from '../utils/deriveZone';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

// Canonical zone values, matching what deriveZone (and the backend) produce, so
// an autofilled zone lines up cleanly with a dropdown option.
const ZONES = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
const LAND_TYPES = ['Commercial', 'Industrial', 'Others'];
const POLLUTION_ZONES = ['Green', 'Yellow', 'Red'];
const BROKER_OPTIONS = ['Yes', 'No'];
const STATUS_OPTIONS = ['Under construction', 'Build to suit', 'Ready to move'];
const OWNER_TYPES = ['Individual', 'Company', '3PL'];
const OWNER_WARMTH_OPTIONS = ['Green', 'Yellow', 'Red'];
const WAREHOUSE_TYPES = ['PEB', 'RCC', 'Shed', 'BTS'];

const INDIA_STATE_CITIES = {
  'Andhra Pradesh': ['Alluri Sitharama Raju', 'Anakapalli', 'Anantapur', 'Ananthapuramu', 'Annamayya', 'Bapatla', 'Bhimavaram', 'Chittoor', 'Dr. B. R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Krishna', 'Kurnool', 'Machilipatnam', 'Markapuram', 'Nandyal', 'Nellore', 'NTR', 'Ongole', 'Palnadu', 'Parvathipuram Manyam', 'Polavaram', 'Prakasam', 'Rajahmundry', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tenali', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  'Arunachal Pradesh': ['Along', 'Anjaw', 'Bichom', 'Bomdila', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Itanagar', 'Kamle', 'Keyi Panyor', 'Kra Daadi', 'Kurung Kumey', 'Lepa-Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Naharlagun', 'Namsai', 'Pakke-Kessang', 'Papum Pare', 'Pasighat', 'Shi-Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang', 'Ziro'],
  'Assam': ['Bajali', 'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Guwahati', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Silchar', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Sribhumi', 'Tamulpur', 'Tezpur', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
  'Bihar': ['Ara', 'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bettiah', 'Bhagalpur', 'Bhojpur', 'Bihar Sharif', 'Buxar', 'Chapra', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Hajipur', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Motihari', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sasaram', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  'Chhattisgarh': ['Ambikapur', 'Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bhilai', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Jagdalpur', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kawardha', 'Khairagarh-Chhuikhadan-Gandai', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Manendragarh-Chirmiri-Bharatpur', 'Mohla-Manpur-Ambagarh Chowki', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja'],
  'Goa': ['Bicholim', 'Calangute', 'Kushavati', 'Mapusa', 'Margao', 'Mormugao', 'North Goa', 'Panaji', 'Ponda', 'Sanquelim', 'South Goa', 'Vasco da Gama'],
  'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahej', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Dwarka', 'Gandhidham', 'Gandhinagar', 'Gir Somnath', 'Halol', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Mundra', 'Nadiad', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Sanand', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  'Haryana': ['Ambala', 'Bahadurgarh', 'Bawal', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kundli', 'Kurukshetra', 'Mahendragarh', 'Manesar', 'Narnaul', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  'Himachal Pradesh': ['Baddi', 'Bilaspur', 'Chamba', 'Dharamshala', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Nahan', 'Nalagarh', 'Paonta Sahib', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
  'Jharkhand': ['Bokaro', 'Chaibasa', 'Chatra', 'Chirkunda', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamshedpur', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Medininagar', 'Pakur', 'Palamu', 'Phusro', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
  'Karnataka': ['Bagalkot', 'Ballari', 'Bangalore', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Hosapete', 'Hubballi', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mangaluru', 'Mysuru', 'Raichur', 'Ramanagara', 'Robertsonpet', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir'],
  'Kerala': ['Alappuzha', 'Attingal', 'Ernakulam', 'Idukki', 'Irinjalakuda', 'Kannur', 'Kasaragod', 'Kochi', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Punalur', 'Thiruvananthapuram', 'Thrippunithura', 'Thrissur', 'Wayanad'],
  'Madhya Pradesh': ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Itarsi', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Maihar', 'Mandla', 'Mandsaur', 'Mauganj', 'Morena', 'Murwara', 'Narmadapuram', 'Narsinghpur', 'Neemuch', 'Niwari', 'Pandhurna', 'Panna', 'Pithampur', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
  'Maharashtra': ['Ahilyanagar / Ahmednagar', 'Ahmednagar', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar', 'Chhatrapati Sambhajinagar / Aurangabad', 'Dharashiv', 'Dharashiv / Osmanabad', 'Dhule', 'Dombivli', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Malegaon', 'Mumbai', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Navi Mumbai', 'Palghar', 'Panvel', 'Parbhani', 'Pimpri-Chinchwad', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Vasai-Virar', 'Wardha', 'Washim', 'Yavatmal'],
  'Manipur': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  'Meghalaya': ['Baghmara', 'East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'Eastern West Khasi Hills', 'Jowai', 'Nongstoin', 'North Garo Hills', 'Ri Bhoi', 'Shillong', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'Tura', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills', 'Williamnagar'],
  'Mizoram': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  'Nagaland': ['Chümoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Meluri', 'Mokokchung', 'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyü', 'Tuensang', 'Wokha', 'Zunheboto', 'Zünheboto'],
  'Odisha': ['Angul', 'Balangir', 'Balasore', 'Barbil', 'Bargarh', 'Baripada', 'Bhadrak', 'Bhawanipatna', 'Bhubaneswar', 'Boudh', 'Brahmapur', 'Cuttack', 'Debagarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Paradip', 'Puri', 'Rayagada', 'Rourkela', 'Sambalpur', 'Subarnapur', 'Sundargarh', 'Talcher'],
  'Punjab': ['Abohar', 'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Firozpur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Phagwara', 'Rajpura', 'Ropar', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Sri Muktsar Sahib', 'Tarn Taran'],
  'Rajasthan': ['Ajmer', 'Alwar', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bhiwadi', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Deeg', 'Dholpur', 'Didwana-Kuchaman', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Khairthal-Tijara', 'Kishangarh', 'Kota', 'Kotputli-Behror', 'Nagaur', 'Neemrana', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand', 'Salumbar', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  'Sikkim': ['Gangtok', 'Gyalshing', 'Jorethang', 'Mangan', 'Namchi', 'Pakyong', 'Rangpo', 'Soreng'],
  'Tamil Nadu': ['Ambattur', 'Ariyalur', 'Avadi', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Hosur', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Kumbakonam', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Nagercoil', 'Namakkal', 'Ooty', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Sivakasi', 'Sriperumbudur', 'Tambaram', 'Tenkasi', 'Thanjavur', 'The Nilgiris', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupattur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'Telangana': ['Adilabad', 'Bhadradri Kothagudem', 'Bhongir', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Kumuram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mahbubnagar', 'Mancherial', 'Medak', 'Medchal', 'Medchal-Malkajgiri', 'Miryalaguda', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ramagundam', 'Ranga Reddy', 'Sangareddy', 'Shamirpet', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri', 'Zaheerabad'],
  'Tripura': ['Agartala', 'Ambassa', 'Belonia', 'Dhalai', 'Dharmanagar', 'Gomati', 'Kailasahar', 'Khowai', 'North Tripura', 'Sabroom', 'Sepahijala', 'South Tripura', 'Udaipur', 'Unakoti', 'West Tripura'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Faizabad', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Greater Noida', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Noida', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Rae Bareli', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi', 'Vrindavan'],
  'Uttarakhand': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haldwani', 'Haridwar', 'Kashipur', 'Kotdwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Ramnagar', 'Rishikesh', 'Roorkee', 'Rudraprayag', 'Rudrapur', 'Sitarganj', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  'West Bengal': ['Alipurduar', 'Asansol', 'Bally', 'Bankura', 'Barasat', 'Bardhaman', 'Barrackpore', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Durgapur', 'Haldia', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kalyani', 'Kharagpur', 'Kolkata', 'Krishnanagar', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'Raiganj', 'Rishra', 'Serampore', 'Shantipur', 'Siliguri', 'South 24 Parganas', 'Uluberia', 'Uttar Dinajpur'],
  // Union Territories
  'Andaman and Nicobar Islands': ['Car Nicobar', 'Diglipur', 'Mayabunder', 'Nicobar', 'North and Middle Andaman', 'Port Blair', 'Rangat', 'South Andaman'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Amli', 'Dadra and Nagar Haveli', 'Daman', 'Diu', 'Silvassa'],
  'Delhi': ['Central Delhi', 'Central North Delhi', 'Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Old Delhi', 'Outer North Delhi', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'Jammu and Kashmir': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Sopore', 'Srinagar', 'Udhampur'],
  'Ladakh': ['Changthang', 'Drass', 'Kargil', 'Leh', 'Nubra', 'Sham', 'Zanskar'],
  'Lakshadweep': ['Agatti', 'Andrott', 'Kavaratti', 'Lakshadweep', 'Minicoy'],
  'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
};
const INDIA_STATES = Object.keys(INDIA_STATE_CITIES).sort();

const INITIAL_VALUES = {
  warehouseOwnerType: '', warehouseType: '', zone: '', address: '',
  city: '', state: '', postalCode: '', googleLocation: '',
  contactPerson: '', contactNumber: '',
  totalSpaceSqft: [1000], ratePerSqft: '', offeredSpaceSqft: '', numberOfDocks: '',
  clearHeightFt: '', availability: '', isBroker: '', uploadedBy: '',
  visibility: true, compliances: '', otherSpecifications: '',
  latitude: '', longitude: '', fireNocAvailable: false,
  fireSafetyMeasures: '', landType: '', approachRoadWidth: '',
  powerKva: '', pollutionZone: '', vaastuCompliance: '',
  dimensions: '', parkingDockingSpace: '', photos: '', media: null,
  // Newly added fields
  listing_type: '',
  alt_phone_number: '', land_parcel_size: '', builtup_area: '',
  owner_warmnth: '', distance_from_highway: '', is_builder: false,
  owner_of_multiple_sites: '', carpet_area: '', nearest_transport: '',
  fire_exits: '', fire_compliance_cert_type: '',
  negotiated_rent: '', washroom_count: '',
  ownerCompanyName: '', ownerAltPoc: '',
  gateSizeFt: '', dockApronLengthFt: '', setbackArea: '', ccRoads: '',
  wallAndSecurityRoom: '', plinthHeightFt: '',
  dockDimension: '', canopyType: '', dockPlatformType: '', otherDockingSpecs: '',
  flooringType: '', floorStrengthPerSqm: '', ventilationType: '',
  ventilationAirChangesPerDay: '', insulationPresent: '', insulationType: '',
  lightingDetails: '', wogVerified: false, centreHeight: '',
  status: '', handoverDate: '', lockInDate: '',
  cam: '', chargeableArea: '',
};

/** Flatten initialData (including nested WarehouseData) into form shape */
const toFormValues = (d) => {
  if (!d) return { ...INITIAL_VALUES };
  const wd = d.WarehouseData || d.warehouseData || {};
  return {
    warehouseOwnerType: d.warehouseOwnerType || '',
    warehouseType: d.warehouseType || '',
    // Autofill zone from state at edit time when the record has none. An existing
    // zone is preserved (the user can still change it via the dropdown).
    zone: d.zone || (d.state ? deriveZone(d.state) : ''),
    address: d.address || '',
    city: d.city || '',
    state: d.state || '',
    postalCode: d.postalCode || '',
    googleLocation: d.googleLocation || '',
    contactPerson: d.contactPerson || '',
    contactNumber: d.contactNumber || '',
    totalSpaceSqft: Array.isArray(d.totalSpaceSqft)
      ? d.totalSpaceSqft
      : d.totalSpaceSqft ? [d.totalSpaceSqft] : [1000],
    ratePerSqft: d.ratePerSqft ?? '',
    offeredSpaceSqft: d.offeredSpaceSqft ?? '',
    numberOfDocks: d.numberOfDocks ?? '',
    clearHeightFt: d.clearHeightFt ?? '',
    availability: d.availability || '',
    isBroker: d.isBroker || '',
    uploadedBy: d.uploadedBy || '',
    visibility: d.visibility === true || d.visibility === 'true' || d.visibility === 1,
    compliances: d.compliances || '',
    otherSpecifications: d.otherSpecifications || '',
    latitude: wd.latitude ?? '',
    longitude: wd.longitude ?? '',
    fireNocAvailable: wd.fireNocAvailable === true || wd.fireNocAvailable === 'true',
    fireSafetyMeasures: wd.fireSafetyMeasures || '',
    landType: wd.landType || '',
    approachRoadWidth: wd.approachRoadWidth ?? '',
    powerKva: wd.powerKva ?? '',
    pollutionZone: wd.pollutionZone || '',
    vaastuCompliance: wd.vaastuCompliance === true || wd.vaastuCompliance === 'true',
    dimensions: wd.dimensions || '',
    parkingDockingSpace: wd.parkingDockingSpace || '',
    photos: d.photos || '',
    media: getMediaFromWarehouse(d),
    // Newly added fields
    listing_type: d.listing_type || '',
    alt_phone_number: d.alt_phone_number || '',
    land_parcel_size: d.land_parcel_size || '',
    builtup_area: d.builtup_area || '',
    owner_warmnth: d.owner_warmnth || '',
    distance_from_highway: d.distance_from_highway || '',
    is_builder: d.is_builder === true || d.is_builder === 'true',
    owner_of_multiple_sites: d.owner_of_multiple_sites || '',
    carpet_area: d.carpet_area || '',
    nearest_transport: d.nearest_transport || '',
    fire_exits: d.fire_exits || '',
    fire_compliance_cert_type: d.fire_compliance_cert_type || '',
    negotiated_rent: d.negotiated_rent || '',
    washroom_count: d.washroom_count || '',
    ownerCompanyName: d.ownerCompanyName || '',
    ownerAltPoc: d.ownerAltPoc || '',
    gateSizeFt: d.gateSizeFt || '',
    dockApronLengthFt: d.dockApronLengthFt || '',
    setbackArea: d.setbackArea || '',
    ccRoads: d.ccRoads || '',
    wallAndSecurityRoom: d.wallAndSecurityRoom || '',
    plinthHeightFt: d.plinthHeightFt || '',
    dockDimension: d.dockDimension || '',
    canopyType: d.canopyType || '',
    dockPlatformType: d.dockPlatformType || '',
    otherDockingSpecs: d.otherDockingSpecs || '',
    flooringType: d.flooringType || '',
    floorStrengthPerSqm: d.floorStrengthPerSqm || '',
    ventilationType: d.ventilationType || '',
    ventilationAirChangesPerDay: d.ventilationAirChangesPerDay || '',
    insulationPresent: d.insulationPresent || '',
    insulationType: d.insulationType || '',
    lightingDetails: d.lightingDetails || '',
    wogVerified: d.wogVerified === true || d.wogVerified === 'true',
    centreHeight: d.centreHeight || '',
    status: d.status || '',
    handoverDate: d.handoverDate ? String(d.handoverDate).slice(0, 10) : '',
    lockInDate: d.lockInDate ? String(d.lockInDate).slice(0, 10) : '',
    cam: d.cam || '',
    chargeableArea: d.chargeableArea ?? '',
  };
};

// ── Shared inline styles ──────────────────────────────────────────────────────

const labelStyle = (mobile) => ({
  display: 'block',
  marginBottom: 6,
  fontSize: mobile ? 13 : 14,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: mobile ? 'uppercase' : 'none',
  letterSpacing: mobile ? 0.5 : 0,
});
const inputBase = (mobile) => ({
  width: '100%',
  minHeight: mobile ? 44 : 36,
  padding: mobile ? '10px 14px' : '6px 11px',
  fontSize: mobile ? 16 : 14,
  background: 'var(--bg-primary, #141414)',
  border: '1px solid var(--border-primary, #303030)',
  borderRadius: 8,
  color: 'var(--text-primary, #fff)',
  outline: 'none',
  boxSizing: 'border-box',
});
const errorStyle = { color: '#ff4d4f', fontSize: 13, marginTop: 4 };
const sectionTitle = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '24px 0 16px' };

// Scroll to a form field, walking up to the nearest scrollable ancestor and
// computing the offset manually. This is more reliable than scrollIntoView for
// nested scroll containers (e.g. fields inside a modal body with overflow: auto).
// Accepts a single field name or an array — when given an array, picks the
// field whose DOM element appears topmost in the document.
const scrollFieldIntoView = (fieldNameOrList) => {
  const names = Array.isArray(fieldNameOrList) ? fieldNameOrList : [fieldNameOrList];
  let el = null;
  let topY = Infinity;
  for (const name of names) {
    if (!name) continue;
    const candidate = document.querySelector(`[data-field="${name}"]`);
    if (!candidate) continue;
    const y = candidate.getBoundingClientRect().top;
    if (y < topY) { topY = y; el = candidate; }
  }
  if (!el) return;
  let container = el.parentElement;
  while (container && container !== document.body) {
    const style = window.getComputedStyle(container);
    if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) break;
    container = container.parentElement;
  }
  if (container && container !== document.body) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (elRect.height / 2);
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
};

// ── Reusable field components ─────────────────────────────────────────────────

const Field = ({ label, required, error, children, style, mobile, tooltip }) => (
  <div style={{ marginBottom: 20, ...style }}>
    {label && (
      <label style={labelStyle(mobile)}>
        {label}
        {required && <span style={{ color: '#ff4d4f' }}> *</span>}
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <QuestionCircleOutlined
              style={{
                marginLeft: 6,
                color: 'var(--text-secondary, #888)',
                cursor: 'help',
                fontSize: mobile ? 13 : 13,
              }}
            />
          </Tooltip>
        )}
      </label>
    )}
    {children}
    {error && <div style={errorStyle}>{error}</div>}
  </div>
);

const TextInput = ({ value, onChange, mobile, placeholder, type = 'text', inputMode, maxLength, autoComplete, ...rest }) => (
  <input
    type={type}
    inputMode={inputMode}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    autoComplete={autoComplete || 'off'}
    style={inputBase(mobile)}
    {...rest}
  />
);

const TextAreaInput = ({ value, onChange, mobile, placeholder, rows = 3, ...rest }) => (
  <textarea
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{ ...inputBase(mobile), resize: 'vertical', fontFamily: 'inherit' }}
    {...rest}
  />
);

const SelectInput = ({ value, onChange, mobile, placeholder, options, ...rest }) => {
  // Preserve free-text values that don't match a predefined option, so an
  // existing entry is shown (and not silently overwritten) in edit mode while
  // the dropdown still lets the user switch to a standard option.
  const hasCustomValue = value != null && value !== '' && !options.includes(value);
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputBase(mobile),
        appearance: 'auto',
        cursor: 'pointer',
      }}
      {...rest}
    >
      <option value="" disabled>{placeholder}</option>
      {hasCustomValue && <option value={value}>{value} (current)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

const ComboBox = ({ value, onChange, options, placeholder, disabled, mobile, ...rest }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hasCustomValue = value != null && value !== '' && !options.includes(value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={open ? query : (value || '')}
        placeholder={disabled ? 'Select state first' : placeholder}
        disabled={!!disabled}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        autoComplete="off"
        style={{ ...inputBase(mobile), cursor: disabled ? 'not-allowed' : 'text' }}
        {...rest}
      />
      {open && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          maxHeight: 220, overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none',
          background: 'var(--bg-secondary, #1f1f1f)',
          border: '1px solid var(--border-primary, #303030)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          scrollbarWidth: 'thin',
        }}>
          {hasCustomValue && !query && (
            <li
              onMouseDown={() => select(value)}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary, #888)', fontStyle: 'italic' }}
            >
              {value} (current)
            </li>
          )}
          {filtered.length > 0 ? filtered.map(o => (
            <li
              key={o}
              onMouseDown={() => select(o)}
              style={{
                padding: mobile ? '11px 14px' : '8px 12px',
                fontSize: mobile ? 15 : 14,
                cursor: 'pointer',
                color: o === value ? 'var(--text-primary, #fff)' : 'var(--text-primary, #ddd)',
                fontWeight: o === value ? 700 : 400,
                background: o === value ? 'var(--bg-hover, rgba(255,255,255,0.06))' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))'}
              onMouseLeave={e => e.currentTarget.style.background = o === value ? 'var(--bg-hover, rgba(255,255,255,0.06))' : 'transparent'}
            >
              {o}
            </li>
          )) : (
            <li style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary, #888)' }}>
              No matches{query ? ` for "${query}"` : ''}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

const DateInput = ({ value, onChange, mobile, placeholder }) => (
  <DatePicker
    value={value ? dayjs(value, 'YYYY-MM-DD') : null}
    onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : '')}
    format="DD/MM/YYYY"
    placeholder={placeholder || 'DD/MM/YYYY'}
    size={mobile ? 'large' : 'middle'}
    className="wf-datepicker"
    style={{
      width: '100%',
      minHeight: mobile ? 44 : 36,
      background: 'var(--bg-primary, #141414)',
      border: '1px solid var(--border-primary, #303030)',
      borderRadius: 8,
      fontSize: mobile ? 16 : 14,
    }}
    styles={{ popup: { root: { zIndex: 2000 } } }}
    allowClear
  />
);

const ToggleSwitch = ({ checked, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <Switch
    checked={checked}
    onChange={onChange}
    checkedChildren={yesLabel}
    unCheckedChildren={noLabel}
  />
);

const Section = ({ title, children }) => (
  <div>
    <div style={sectionTitle}>{title}</div>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const WarehouseForm = ({ visible, onCancel, onSubmit, initialData = null, loading = false, reviewActions = null }) => {
  const { isMobile } = useViewport();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [contactTouched, setContactTouched] = useState(false);
  // Once the user manually picks a zone, stop autofilling it from the state.
  const [zoneTouched, setZoneTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      setValues(toFormValues(initialData));
      setErrors({});
      setInitialSnapshot(initialData);
      setContactTouched(false);
      setZoneTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Patch in background-fetched contact number without resetting the form
  useEffect(() => {
    if (visible && !contactTouched && initialData && initialSnapshot &&
      initialData.id === initialSnapshot.id &&
      initialData.contactNumber !== initialSnapshot.contactNumber) {
      setValues(prev => ({ ...prev, contactNumber: initialData.contactNumber || prev.contactNumber }));
      setInitialSnapshot(initialData);
    }
  }, [visible, initialData, initialSnapshot, contactTouched]);

  const set = (field) => (val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (field === 'contactNumber') setContactTouched(true);
    if (field === 'zone') setZoneTouched(true);
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const setStateField = (val) => {
    const autoCity = val === 'Delhi' ? 'New Delhi' : val === 'Chandigarh' ? 'Chandigarh' : '';
    setValues(prev => ({
      ...prev,
      state: val,
      city: autoCity,
      zone: !zoneTouched && val ? deriveZone(val) : prev.zone,
    }));
    setErrors(prev => ({ ...prev, state: null, city: null }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!values.listing_type) e.listing_type = 'Listing type is required';
    if (!values.warehouseType?.trim()) e.warehouseType = 'Warehouse type is required';
    if (!values.address?.trim()) e.address = 'Address is required';
    if (!values.city?.trim()) e.city = 'City is required';
    if (!values.state?.trim()) e.state = 'State is required';
    if (!values.contactPerson?.trim()) e.contactPerson = 'Contact person is required';
    if (!values.contactNumber?.trim()) e.contactNumber = 'Contact number is required';
    const spaces = (values.totalSpaceSqft || []).filter(v => v != null && v > 0);
    if (spaces.length === 0) e.totalSpaceSqft = 'At least one space value is required';
    if (!values.ratePerSqft && values.ratePerSqft !== 0) e.ratePerSqft = 'Rate per sq ft is required';
    if (!values.uploadedBy?.trim()) e.uploadedBy = 'Uploaded by is required';
    if (!values.compliances) e.compliances = 'Compliance info is required';

    if (values.chargeableArea !== '' && values.chargeableArea != null) {
      const n = Number(values.chargeableArea);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        e.chargeableArea = 'Chargeable area must be a non-negative whole number';
      }
    }

    // Latitude and longitude validation removed to support high precision formats

    setErrors(e);

    const missingKeys = Object.keys(e);
    if (missingKeys.length > 0) {
      message.error(
        missingKeys.length === 1
          ? `Please fill in the required field: ${e[missingKeys[0]]}`
          : `Please fill in ${missingKeys.length} required fields`
      );
      setTimeout(() => scrollFieldIntoView(missingKeys), 50);
    }

    return missingKeys.length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  // Build the warehouse payload from the current form values. Extracted from
  // handleSubmit so the review actions (Accept/Reject) can persist any in-form
  // edits before approving/rejecting — otherwise unsaved edits never reach the
  // promoted warehouse or the submitter's WhatsApp notification.
  const buildPayload = () => {
    // Build media from form state (the FileUpload now manages a media object)
    const media = values.media || { images: [], videos: [], docs: [] };
    const hasMedia = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0) > 0;

    // Double-write: flatten media back to photos CSV for legacy column
    const allUrls = [...(media.images || []), ...(media.videos || []), ...(media.docs || [])];
    const photosValue = allUrls.length > 0 ? allUrls.join(',') : null;

    return {
        warehouseOwnerType: values.warehouseOwnerType || null,
        warehouseType: values.warehouseType,
        address: values.address,
        googleLocation: values.googleLocation || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode || null,
        zone: values.zone,
        contactPerson: values.contactPerson,
        contactNumber: values.contactNumber,
        totalSpaceSqft: (values.totalSpaceSqft || []).filter(v => v != null && v > 0),
        offeredSpaceSqft: values.offeredSpaceSqft ? String(values.offeredSpaceSqft) : null,
        numberOfDocks: values.numberOfDocks ? String(values.numberOfDocks) : null,
        clearHeightFt: values.clearHeightFt ? String(values.clearHeightFt) : null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft ? String(values.ratePerSqft) : null,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
        visibility: Boolean(values.visibility),
        isBroker: values.isBroker || null,
        photos: photosValue,
        media: hasMedia ? media : null,
        // Newly added fields (all optional)
        listing_type: values.listing_type || null,
        alt_phone_number: values.alt_phone_number || null,
        land_parcel_size: values.land_parcel_size || null,
        builtup_area: values.builtup_area || null,
        owner_warmnth: values.owner_warmnth || null,
        distance_from_highway: values.distance_from_highway || null,
        is_builder: typeof values.is_builder === 'boolean' ? values.is_builder : null,
        owner_of_multiple_sites: values.owner_of_multiple_sites || null,
        carpet_area: values.carpet_area || null,
        nearest_transport: values.nearest_transport || null,
        fire_exits: values.fire_exits || null,
        fire_compliance_cert_type: values.fire_compliance_cert_type || null,
        negotiated_rent: values.negotiated_rent || null,
        washroom_count: values.washroom_count || null,
        ownerCompanyName: values.ownerCompanyName || null,
        ownerAltPoc: values.ownerAltPoc || null,
        gateSizeFt: values.gateSizeFt || null,
        dockApronLengthFt: values.dockApronLengthFt || null,
        setbackArea: values.setbackArea || null,
        ccRoads: typeof values.ccRoads === 'boolean'
          ? (values.ccRoads ? 'true' : 'false')
          : (values.ccRoads || null),
        wallAndSecurityRoom: values.wallAndSecurityRoom || null,
        plinthHeightFt: values.plinthHeightFt || null,
        dockDimension: values.dockDimension || null,
        canopyType: values.canopyType || null,
        dockPlatformType: values.dockPlatformType || null,
        otherDockingSpecs: values.otherDockingSpecs || null,
        flooringType: values.flooringType || null,
        floorStrengthPerSqm: values.floorStrengthPerSqm || null,
        ventilationType: values.ventilationType || null,
        ventilationAirChangesPerDay: values.ventilationAirChangesPerDay || null,
        insulationPresent: typeof values.insulationPresent === 'boolean'
          ? (values.insulationPresent ? 'true' : 'false')
          : (values.insulationPresent || null),
        insulationType: values.insulationType || null,
        lightingDetails: values.lightingDetails || null,
        wogVerified: typeof values.wogVerified === 'boolean' ? values.wogVerified : null,
        centreHeight: values.centreHeight || null,
        status: values.status || null,
        handoverDate: values.handoverDate || null,
        lockInDate: values.lockInDate || null,
        cam: values.cam || null,
        chargeableArea: values.chargeableArea === '' || values.chargeableArea == null
          ? null
          : Number(values.chargeableArea),
        warehouseData: {
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          fireNocAvailable: Boolean(values.fireNocAvailable),
          fireSafetyMeasures: values.fireSafetyMeasures || null,
          landType: values.landType || null,
          approachRoadWidth: values.approachRoadWidth ? String(values.approachRoadWidth) : null,
          dimensions: values.dimensions || null,
          parkingDockingSpace: values.parkingDockingSpace || null,
          pollutionZone: values.pollutionZone || null,
          powerKva: values.powerKva ? String(values.powerKva) : null,
          vaastuCompliance: typeof values.vaastuCompliance === 'boolean'
            ? (values.vaastuCompliance ? 'true' : 'false')
            : (values.vaastuCompliance || null),
        },
      };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(buildPayload());
      setValues(INITIAL_VALUES);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    setValues(INITIAL_VALUES);
    setErrors({});
    clearErrors();
    onCancel();
  }, [onCancel]);

  // ── totalSpaceSqft list helpers ─────────────────────────────────────────────

  const addSpace = () => set('totalSpaceSqft')([...(values.totalSpaceSqft || []), '']);
  const removeSpace = (i) => set('totalSpaceSqft')(values.totalSpaceSqft.filter((_, idx) => idx !== i));
  const setSpace = (i, v) => {
    const next = [...values.totalSpaceSqft];
    next[i] = v === '' ? '' : Number(v);
    set('totalSpaceSqft')(next);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const m = isMobile;
  const row = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
      {children}
    </div>
  );
  const col = (children, half = false) => (
    <div style={{ width: (half && !m) ? 'calc(50% - 8px)' : '100%' }}>
      {children}
    </div>
  );

  if (!visible) return null;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={handleCancel}
      title={initialData ? 'Edit Warehouse' : 'Create New Warehouse'}
      maxWidth="900px"
      className="warehouse-form-modal"
    >
      <Spin
        spinning={loading || submitting}
        tip={<div style={{ color: 'var(--text-primary)', fontSize: m ? 16 : 14, marginTop: 8 }}>
          {submitting ? 'Saving warehouse...' : 'Loading...'}
        </div>}
        size={m ? 'large' : 'default'}
      >
        <form onSubmit={handleSubmit} style={{ color: 'var(--text-primary)' }}>

          {/* ── Owner Details ───────────────────────────────────── */}
          <Section title="Owner Details">
            {row(<>
              {col(
                <Field label="Listing Type" required error={errors.listing_type}>
                  <SelectInput mobile={m} value={values.listing_type} onChange={set('listing_type')} placeholder="Select listing type" options={['Rent', 'Sale']} data-field="listing_type" />
                </Field>,
                true)}
              {col(
                <Field label="Warehouse Owner Type">
                  <SelectInput mobile={m} value={values.warehouseOwnerType} onChange={set('warehouseOwnerType')} placeholder="Select owner type" options={OWNER_TYPES} data-field="warehouseOwnerType" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Owner Company Name" tooltip="Please specify details of company / 3PL.">
                  <TextInput mobile={m} value={values.ownerCompanyName} onChange={set('ownerCompanyName')} placeholder="Company name" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Contact Person" required error={errors.contactPerson}>
                  <TextInput mobile={m} value={values.contactPerson} onChange={set('contactPerson')} placeholder="Contact person name" autoComplete="name" data-field="contactPerson" />
                </Field>,
                true)}
              {col(
                <Field label="Contact Number" required error={errors.contactNumber}>
                  <TextInput mobile={m} value={values.contactNumber} onChange={set('contactNumber')} placeholder="10-digit phone number" type="tel" inputMode="tel" maxLength={15} autoComplete="tel" data-field="contactNumber" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Alternate Phone Number">
                  <TextInput mobile={m} value={values.alt_phone_number} onChange={set('alt_phone_number')} placeholder="Alternate phone" type="tel" inputMode="tel" maxLength={15} />
                </Field>,
                true)}
              {col(
                <Field label="Owner Alternate POC">
                  <TextInput mobile={m} value={values.ownerAltPoc} onChange={set('ownerAltPoc')} placeholder="Alternate point of contact" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Is Broker">
                  <ToggleSwitch checked={values.isBroker === true || values.isBroker === 'true' || values.isBroker === 'Yes'} onChange={(v) => set('isBroker')(v ? 'Yes' : 'No')} />
                </Field>,
                true)}
              {col(
                <Field label="Is Builder">
                  <ToggleSwitch checked={values.is_builder} onChange={set('is_builder')} />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Owner Warmth" tooltip="Rate the owner's personality. Green = positive and collaborative; Yellow = neutral; Red = hard to deal with.">
                  <SelectInput mobile={m} value={values.owner_warmnth} onChange={set('owner_warmnth')} placeholder="Select owner warmth" options={OWNER_WARMTH_OPTIONS} />
                </Field>,
                true)}
              {col(
                <Field label="Owner of Multiple Sites">
                  <SelectInput mobile={m} value={values.owner_of_multiple_sites} onChange={set('owner_of_multiple_sites')} placeholder="Select Yes / No" options={['Yes', 'No']} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Uploaded By" required error={errors.uploadedBy} tooltip="Mention your name.">
                  <TextInput mobile={m} value={values.uploadedBy} onChange={set('uploadedBy')} placeholder="Uploader name" data-field="uploadedBy" />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Availability ────────────────────────────────────── */}
          <Section title="Availability">
            {row(<>
              {col(
                <Field label="Availability" tooltip="If the space can be booked (now/in future) within the next 6 months, then Y, else N.">
                  <SelectInput mobile={m} value={values.availability} onChange={set('availability')} placeholder="Select availability" options={['Yes', 'No']} />
                </Field>,
                true)}
              {col(
                <Field label="Status" tooltip="Mention the building construction status (not related to whether it is occupied or not).">
                  <SelectInput mobile={m} value={values.status} onChange={set('status')} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Handover Date" tooltip="Mention date from which warehouse can be realistically given.">
                  <DateInput mobile={m} value={values.handoverDate} onChange={set('handoverDate')} />
                </Field>,
                true)}
              {col(
                <Field label="Lock-in Date" tooltip="Fill if Availability = N; by when will the lock-in / agreement duration end, when it could potentially become available.">
                  <DateInput mobile={m} value={values.lockInDate} onChange={set('lockInDate')} />
                </Field>,
                true)}
            </>)}
          </Section>

          {/* ── Location Details ────────────────────────────────── */}
          <Section title="Location Details">
            <Field label="Address" required error={errors.address} tooltip="Please mention the locality, but not the exact address.">
              <TextAreaInput mobile={m} value={values.address} onChange={set('address')} placeholder="Enter locality" rows={m ? 3 : 2} data-field="address" />
            </Field>

            {row(<>
              {col(
                <Field label="State" required error={errors.state}>
                  <ComboBox mobile={m} value={values.state} onChange={setStateField} options={INDIA_STATES} placeholder="Select state" data-field="state" />
                </Field>,
                true)}
              {col(
                <Field label="City" required error={errors.city}>
                  <ComboBox mobile={m} value={values.city} onChange={set('city')} options={INDIA_STATE_CITIES[values.state] || []} placeholder="Select city" disabled={!values.state} data-field="city" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Postal Code">
                  <TextInput mobile={m} value={values.postalCode} onChange={set('postalCode')} placeholder="Postal code" inputMode="numeric" autoComplete="postal-code" />
                </Field>,
                true)}
              {col(
                <Field label="Zone" error={errors.zone} tooltip="Auto-filled from the State — pick a value here to override it.">
                  <SelectInput mobile={m} value={values.zone} onChange={set('zone')} placeholder="Auto-filled from State" options={ZONES} data-field="zone" />
                </Field>,
                true)}
            </>)}

            <Field label="Google Location URL">
              <TextInput mobile={m} value={values.googleLocation} onChange={set('googleLocation')} placeholder="Google Maps URL" type="url" />
            </Field>

            {row(<>
              {col(
                <Field label="Latitude" error={errors.latitude}>
                  <TextInput mobile={m} value={values.latitude} onChange={set('latitude')} placeholder="Enter latitude" />
                </Field>,
                true)}
              {col(
                <Field label="Longitude" error={errors.longitude}>
                  <TextInput mobile={m} value={values.longitude} onChange={set('longitude')} placeholder="Enter longitude" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Nearest Bus Transport" tooltip="Please mention the nearest bus stop and its distance.">
                  <TextInput mobile={m} value={values.nearest_transport} onChange={set('nearest_transport')} placeholder="Nearest bus stand / depot" />
                </Field>,
                true)}
              {col(
                <Field label="Distance from Highway">
                  <TextInput mobile={m} value={values.distance_from_highway} onChange={set('distance_from_highway')} placeholder="e.g. 2 km" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Approach Road Width (ft)">
                  <TextInput mobile={m} value={values.approachRoadWidth} onChange={set('approachRoadWidth')} placeholder="Road width" />
                </Field>,
                true)}
              {col(
                <Field label="Land Type">
                  <SelectInput mobile={m} value={values.landType} onChange={set('landType')} placeholder="Select land type" options={LAND_TYPES} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Pollution Zone">
                  <SelectInput mobile={m} value={values.pollutionZone} onChange={set('pollutionZone')} placeholder="Select pollution zone" options={POLLUTION_ZONES} />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Warehouse Technical Specifications ──────────────── */}
          <Section title="Warehouse Technical Specifications">
            {row(
              col(
                <Field label="Warehouse Type" required error={errors.warehouseType} tooltip="Please mention PEB / RCC / Shed. Use 'Shed' for old-style godowns.">
                  <SelectInput mobile={m} value={values.warehouseType} onChange={set('warehouseType')} placeholder="Select warehouse type" options={WAREHOUSE_TYPES} data-field="warehouseType" />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
                <Field label="Offered Area (sq ft)" required error={errors.totalSpaceSqft} tooltip="Please mention all kinds of areas offered, including partition possibilities.">
                  {(values.totalSpaceSqft || []).map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={v ?? ''}
                        onChange={e => setSpace(i, e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Enter space"
                        style={{ ...inputBase(m), flex: 1 }}
                        data-field="totalSpaceSqft"
                      />
                      {values.totalSpaceSqft.length > 1 && (
                        <button type="button" onClick={() => removeSpace(i)}
                          style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: m ? 20 : 16, padding: 8 }}>
                          <MinusCircleOutlined />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addSpace}
                    style={{ ...inputBase(m), cursor: 'pointer', textAlign: 'center', borderStyle: 'dashed', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <PlusOutlined /> Add Space Value
                  </button>
                </Field>,
                true)}
              {col(
                <Field label="Chargeable Area (sq ft)" error={errors.chargeableArea} tooltip="The billable area used to compute rent.">
                  <TextInput mobile={m} value={values.chargeableArea} onChange={v => set('chargeableArea')(String(v).replace(/[^0-9]/g, ''))} placeholder="Chargeable area" type="text" inputMode="numeric" pattern="[0-9]*" data-field="chargeableArea" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Land Parcel Size" tooltip="Please mention the entire parcel size.">
                  <TextInput mobile={m} value={values.land_parcel_size} onChange={set('land_parcel_size')} placeholder="e.g. 5 acres" />
                </Field>,
                true)}
              {col(
                <Field label="Built-up Area" tooltip="Please mention the entire compound's built-up area.">
                  <TextInput mobile={m} value={values.builtup_area} onChange={set('builtup_area')} placeholder="Built-up area" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Carpet Area" tooltip="Please mention the entire carpet area.">
                  <TextInput mobile={m} value={values.carpet_area} onChange={set('carpet_area')} placeholder="Carpet area" />
                </Field>,
                true)}
              {col(
                <Field label="Dimensions">
                  <TextInput mobile={m} value={values.dimensions} onChange={set('dimensions')} placeholder="Warehouse dimensions" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Clear Height (ft)" tooltip="Please mention the side height here.">
                  <TextInput mobile={m} value={values.clearHeightFt} onChange={set('clearHeightFt')} placeholder="Clear Height / Side Height" />
                </Field>,
                true)}
              {col(
                <Field label="Centre Height">
                  <TextInput mobile={m} value={values.centreHeight} onChange={set('centreHeight')} placeholder="Centre height" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Plinth Height (ft)">
                  <TextInput mobile={m} value={values.plinthHeightFt} onChange={set('plinthHeightFt')} placeholder="Plinth height / Dock Height" />
                </Field>,
                true)}
              {col(
                <Field label="Number of Docks">
                  <TextInput mobile={m} value={values.numberOfDocks} onChange={set('numberOfDocks')} placeholder="Number of docks" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Dock Dimension (ft)">
                  <TextInput mobile={m} value={values.dockDimension} onChange={set('dockDimension')} placeholder="e.g. 8x10 ft" />
                </Field>,
                true)}
              {col(
                <Field label="Canopy Type">
                  <TextInput mobile={m} value={values.canopyType} onChange={set('canopyType')} placeholder="Running/Shutter/None" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Dock Apron Length (ft)" tooltip="Please mention the distance from the wall to the dock platform for truck movement.">
                  <TextInput mobile={m} value={values.dockApronLengthFt} onChange={set('dockApronLengthFt')} placeholder="Distance from Dock to Wall in ft" />
                </Field>,
                true)}
              {col(
                <Field label="Dock Platform Type">
                  <TextInput mobile={m} value={values.dockPlatformType} onChange={set('dockPlatformType')} placeholder="None/Extended Platform/Running Platform/Cross Dock" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Compound Gate Width (ft)">
                  <TextInput mobile={m} value={values.gateSizeFt} onChange={set('gateSizeFt')} placeholder="Gate Width" />
                </Field>,
                true)}
              {col(
                <Field label="Setback Area" tooltip="Setback area around the box.">
                  <TextInput mobile={m} value={values.setbackArea} onChange={set('setbackArea')} placeholder="e.g. 5m on all sides" />
                </Field>,
                true)}
            </>)}

            <Field label="Other Docking Specs" tooltip="Please mention if cross docks, levellers, or other specs are present.">
              <TextAreaInput mobile={m} value={values.otherDockingSpecs} onChange={set('otherDockingSpecs')} placeholder="Other docking specifications" rows={m ? 3 : 2} />
            </Field>

            {row(
              col(
                <Field label="CC Roads" tooltip="Are there concrete roads around the warehouse?">
                  <ToggleSwitch checked={values.ccRoads === true || values.ccRoads === 'true' || values.ccRoads === 'Yes'} onChange={(v) => set('ccRoads')(v)} />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                <Field label="Flooring Type">
                  <TextInput mobile={m} value={values.flooringType} onChange={set('flooringType')} placeholder="VDF/FM2" />
                </Field>,
                true)}
              {col(
                <Field label="Floor Strength (per sqm)">
                  <TextInput mobile={m} value={values.floorStrengthPerSqm} onChange={set('floorStrengthPerSqm')} placeholder="e.g. 5 T/sqm" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Ventilation Type" tooltip="Ridge / Turbo / Side Louvers / Windows. Fill what is relevant.">
                  <TextInput mobile={m} value={values.ventilationType} onChange={set('ventilationType')} placeholder="Ridge/Turbo" />
                </Field>,
                true)}
              {col(
                <Field label="Ventilation Air Changes/Day">
                  <TextInput mobile={m} value={values.ventilationAirChangesPerDay} onChange={set('ventilationAirChangesPerDay')} placeholder="Air changes per day" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Insulation Present">
                  <ToggleSwitch checked={values.insulationPresent === true || values.insulationPresent === 'true' || values.insulationPresent === 'Yes'} onChange={(v) => set('insulationPresent')(v)} />
                </Field>,
                true)}
              {col(
                <Field label="Insulation Type">
                  <TextInput mobile={m} value={values.insulationType} onChange={set('insulationType')} placeholder="Insulation type" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Lighting Details" tooltip="Please mention LUX level, else the type of lighting provided.">
                  <TextInput mobile={m} value={values.lightingDetails} onChange={set('lightingDetails')} placeholder="Lux Level" />
                </Field>,
                true)}
              {col(
                <Field label="Power (KVA)">
                  <TextInput mobile={m} value={values.powerKva} onChange={set('powerKva')} placeholder="Power in KVA" />
                </Field>,
                true)}
            </>)}

            <Field label="Parking Space Availability">
              <TextAreaInput mobile={m} value={values.parkingDockingSpace} onChange={set('parkingDockingSpace')} placeholder="Mention area for seperate parking if available" rows={m ? 3 : 2} />
            </Field>

            {row(<>
              {col(
                <Field label="Washroom Count">
                  <TextInput mobile={m} value={values.washroom_count} onChange={set('washroom_count')} placeholder="Number of washrooms" />
                </Field>,
                true)}
              {col(
                <Field label="Security Features">
                  <TextInput mobile={m} value={values.wallAndSecurityRoom} onChange={set('wallAndSecurityRoom')} placeholder="eg: Security Room, CCTV etc" />
                </Field>,
                true)}
            </>)}

            <Field label="Other Specifications">
              <TextAreaInput mobile={m} value={values.otherSpecifications} onChange={set('otherSpecifications')} placeholder="Other specifications" rows={m ? 3 : 2} />
            </Field>
          </Section>

          {/* ── Compliances ─────────────────────────────────────── */}
          <Section title="Compliances">
            <Field label="Compliances" required error={errors.compliances} tooltip="Please only mention conversion-related and Fire NOC-related status.">
              <TextAreaInput mobile={m} value={values.compliances} onChange={set('compliances')} placeholder="Compliance details" rows={m ? 3 : 2} />
            </Field>

            {row(<>
              {col(
                <Field label="Fire Exits">
                  <TextInput mobile={m} value={values.fire_exits} onChange={set('fire_exits')} placeholder="Number of Fire Exits" />
                </Field>,
                true)}
              {col(
                <Field label="Fire NOC Available">
                  <ToggleSwitch checked={values.fireNocAvailable} onChange={set('fireNocAvailable')} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Fire Safety Measures">
                  <TextInput mobile={m} value={values.fireSafetyMeasures} onChange={set('fireSafetyMeasures')} placeholder="eg: Hydrants, Sprinklers etc" />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                <Field label="Fire Compliance Certification Type" tooltip="E.g. in Bangalore there is Fire Advisory, or Fire NOC.">
                  <TextInput mobile={m} value={values.fire_compliance_cert_type} onChange={set('fire_compliance_cert_type')} placeholder="Fire Compliance Certifications" />
                </Field>,
                true)}
              {col(
                <Field label="Vaastu Compliance">
                  <ToggleSwitch checked={values.vaastuCompliance} onChange={set('vaastuCompliance')} />
                </Field>,
                true)}
            </>)}

          </Section>

          {/* ── Commercials ─────────────────────────────────────── */}
          <Section title="Commercials">
            {row(<>
              {col(
                <Field label="Rate per sq ft" required error={errors.ratePerSqft}>
                  <TextInput mobile={m} value={values.ratePerSqft} onChange={set('ratePerSqft')} placeholder="Rate per sq ft" data-field="ratePerSqft" />
                </Field>,
                true)}
              {col(
                <Field label="Negotiated Rent">
                  <TextInput mobile={m} value={values.negotiated_rent} onChange={set('negotiated_rent')} placeholder="Negotiated rent" />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="CAM" tooltip="Common Area Maintenance charges.">
                  <TextInput mobile={m} value={values.cam} onChange={set('cam')} placeholder="CAM charges" />
                </Field>,
                true)
            )}

          </Section>

          {/* ── Metadata ────────────────────────────────────────── */}
          <Section title="Metadata">
            {row(
              col(
                <Field label="Visibility">
                  <ToggleSwitch checked={values.visibility} onChange={set('visibility')} yesLabel="Visible" noLabel="Hidden" />
                </Field>,
                true)
            )}

            <Field label="Upload Files">
              <FileUpload value={values.media} onChange={set('media')} />
            </Field>
          </Section>

          {/* ── WOG Verification (distinct) ──────────────────────── */}
          <div
            style={{
              marginTop: 20,
              padding: m ? 14 : 16,
              border: '1px solid var(--border-primary, #303030)',
              borderRadius: 8,
              background: 'var(--bg-secondary, transparent)',
              display: 'flex',
              flexDirection: m ? 'column' : 'row',
              alignItems: m ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                WOG Verified
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Mark this warehouse as verified by Wareongo.
              </div>
            </div>
            <ToggleSwitch checked={values.wogVerified} onChange={set('wogVerified')} />
          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div
            className={m ? 'warehouse-form-actions' : ''}
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: m ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: 12,
              position: m ? 'sticky' : 'static',
              bottom: m ? 0 : 'auto',
              background: m ? 'var(--bg-secondary)' : 'transparent',
              padding: m ? '16px 0' : 0,
              borderTop: m ? '1px solid var(--border-primary)' : 'none',
            }}
          >
            {reviewActions && (
              <div style={{ display: 'flex', gap: 12, marginRight: m ? 0 : 'auto', order: m ? 3 : 0 }}>
                {typeof reviewActions === 'function'
                  ? reviewActions({ getPayload: buildPayload })
                  : reviewActions}
              </div>
            )}
            <Button
              size="large"
              onClick={handleCancel}
              style={{ minWidth: 120, minHeight: m ? 44 : 'auto', order: m ? 2 : 1, flex: m ? '1' : 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={submitting ? null : <SaveOutlined />}
              loading={submitting}
              disabled={loading}
              style={{ minWidth: 120, minHeight: m ? 44 : 'auto', order: m ? 1 : 2, flex: m ? '1' : 'none' }}
            >
              {submitting ? (m ? 'Saving...' : 'Saving') : `${initialData ? 'Update' : 'Create'} Warehouse`}
            </Button>
          </div>
        </form>
      </Spin>
    </ResponsiveModal>
  );
};

export default WarehouseForm;
